"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export async function updateSettings(formData: FormData) {
  const userId = await requireUserId();
  const sendDays = formData.getAll("sendDays").map(Number);
  const automationMode = String(formData.get("automationMode") ?? "MANUEL") as
    | "MANUEL"
    | "SEMI_AUTOMATIQUE"
    | "AUTOMATIQUE";

  await prisma.prospectionSettings.upsert({
    where: { userId },
    create: {
      userId,
      dailyLimit: Number(formData.get("dailyLimit") ?? 25),
      sendStartHour: Number(formData.get("sendStartHour") ?? 9),
      sendEndHour: Number(formData.get("sendEndHour") ?? 17),
      sendDays: sendDays.length ? sendDays : [1, 2, 3, 4, 5],
      minIntervalMin: Number(formData.get("minIntervalMin") ?? 3),
      maxFollowUps: Number(formData.get("maxFollowUps") ?? 3),
      automationMode,
    },
    update: {
      dailyLimit: Number(formData.get("dailyLimit") ?? 25),
      sendStartHour: Number(formData.get("sendStartHour") ?? 9),
      sendEndHour: Number(formData.get("sendEndHour") ?? 17),
      sendDays: sendDays.length ? sendDays : [1, 2, 3, 4, 5],
      minIntervalMin: Number(formData.get("minIntervalMin") ?? 3),
      maxFollowUps: Number(formData.get("maxFollowUps") ?? 3),
      automationMode,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { signatureHtml: String(formData.get("signatureHtml") ?? "") },
  });

  revalidatePath("/parametres");
}

export async function addToBlacklist(formData: FormData) {
  const userId = await requireUserId();
  await prisma.blacklist.create({
    data: {
      userId,
      email: String(formData.get("email") ?? "") || null,
      domain: String(formData.get("domain") ?? "") || null,
      reason: String(formData.get("reason") ?? "") || null,
    },
  });
  revalidatePath("/parametres");
}

export async function removeFromBlacklist(id: string) {
  await prisma.blacklist.delete({ where: { id } });
  revalidatePath("/parametres");
}

/** RGPD : export complet des données d'un prospect. */
export async function exportProspectData(prospectId: string) {
  const userId = await requireUserId();
  return prisma.prospect.findFirstOrThrow({
    where: { id: prospectId, userId },
    include: { notes_: true, emailMessages: true, scheduledEmails: true, tags: { include: { tag: true } } },
  });
}

/** RGPD : suppression définitive des données d'un prospect. */
export async function deleteProspectData(prospectId: string) {
  const userId = await requireUserId();
  await prisma.prospect.delete({ where: { id: prospectId, userId } });
  revalidatePath("/prospects");
}
