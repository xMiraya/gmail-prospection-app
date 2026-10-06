import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { getOAuthClient, fetchConnectedEmail } from "@/lib/gmail/client";
import { prisma } from "@/lib/db/prisma";

const publicBaseUrl = process.env.NEXTAUTH_URL;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", publicBaseUrl));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || state !== session.user.id) {
    return NextResponse.redirect(new URL("/parametres/gmail?error=oauth_invalid", publicBaseUrl));
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.refresh_token) {
      // Google ne renvoie un refresh_token que lors du tout premier consentement.
      // Si l'utilisateur avait déjà connecté ce compte, on garde l'ancien refresh_token.
      const existing = await prisma.googleAccount.findUnique({ where: { userId: session.user.id } });
      if (!existing) {
        return NextResponse.redirect(
          new URL("/parametres/gmail?error=no_refresh_token", publicBaseUrl)
        );
      }
    }

    const email = await fetchConnectedEmail(oauth2Client);

    await prisma.googleAccount.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        expiryDate: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scope: tokens.scope ?? "",
        connected: true,
      },
      update: {
        email,
        accessToken: tokens.access_token!,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiryDate: new Date(tokens.expiry_date ?? Date.now() + 3600_000),
        scope: tokens.scope ?? "",
        connected: true,
      },
    });

    return NextResponse.redirect(new URL("/parametres/gmail?connected=1", publicBaseUrl));
  } catch (err) {
    console.error("Erreur OAuth Gmail", err);
    return NextResponse.redirect(new URL("/parametres/gmail?error=oauth_failed", publicBaseUrl));
  }
}
