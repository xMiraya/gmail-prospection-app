import { prisma } from "@/lib/db/prisma";
import type { ActivityType, Prisma } from "@prisma/client";

export async function logActivity(
  userId: string,
  type: ActivityType,
  prospectId?: string | null,
  metadata?: Record<string, unknown>,
  campaignId?: string | null
) {
  await prisma.activity.create({
    data: {
      userId,
      type,
      prospectId: prospectId ?? null,
      campaignId: campaignId ?? null,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
