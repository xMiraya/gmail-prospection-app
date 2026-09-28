import { prisma } from "@/lib/db/prisma";

export async function createNotification(
  userId: string,
  data: { type: string; title: string; message: string; link?: string }
) {
  return prisma.notification.create({
    data: { userId, ...data },
  });
}
