import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { prisma } from "@/lib/db/prisma";
import { syncGmailInbox } from "@/lib/gmail/sync";

export const dynamic = "force-dynamic";

// Récupère les nouveaux messages entrants Gmail pour tous les utilisateurs ayant un
// compte Google connecté. Prévu pour tourner toutes les quelques minutes.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const accounts = await prisma.googleAccount.findMany({ where: { connected: true } });
  const results: Record<string, unknown> = {};

  for (const account of accounts) {
    try {
      results[account.userId] = await syncGmailInbox(account.userId);
    } catch (err) {
      results[account.userId] = { error: err instanceof Error ? err.message : "Erreur inconnue" };
    }
  }

  return NextResponse.json(results);
}
