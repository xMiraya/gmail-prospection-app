import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/gmail/client";
import { requireUserId } from "@/lib/auth/session";

export async function GET() {
  const userId = await requireUserId();
  // `state` transporte l'id utilisateur de façon signée serait plus robuste ;
  // ici on s'appuie sur la session déjà vérifiée côté callback.
  const url = getGoogleAuthUrl(userId);
  return NextResponse.redirect(url);
}
