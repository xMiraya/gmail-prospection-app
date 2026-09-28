import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron/auth";
import { prisma } from "@/lib/db/prisma";
import { prepareDueFollowUps } from "@/lib/campaigns/prepare";

export const dynamic = "force-dynamic";

// Prépare les relances arrivées à échéance (sans jamais les envoyer) pour tous
// les utilisateurs ayant au moins une campagne active. Toujours suivi d'une
// vérification "a-t-il répondu ?" avant préparation (voir prepareDueFollowUps).
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });

  const userIds = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    select: { userId: true },
    distinct: ["userId"],
  });

  const results: Record<string, unknown> = {};
  for (const { userId } of userIds) {
    results[userId] = await prepareDueFollowUps(userId);
  }

  return NextResponse.json(results);
}
