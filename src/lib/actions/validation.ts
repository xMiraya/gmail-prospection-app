"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { sendGmailMessage } from "@/lib/gmail/client";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

/**
 * Coeur du principe "l'automatisation prépare, moi je décide" : ces fonctions sont
 * les SEULES portes de sortie d'un ScheduledEmail hors de la file de validation.
 * Aucun email n'est jamais envoyé par un autre chemin que "Valider et envoyer"
 * (immédiat) ou "Valider et programmer" (le job cron l'enverra à l'heure prévue,
 * mais uniquement parce qu'il est déjà passé au statut VALIDE/PROGRAMME).
 */

async function assertOwnedDraft(userId: string, id: string) {
  const email = await prisma.scheduledEmail.findFirst({ where: { id, userId } });
  if (!email) throw new Error("Email introuvable");
  if (email.status === "ENVOYE") throw new Error("Cet email a déjà été envoyé");
  return email;
}

export async function saveEditedEmail(id: string, data: { toEmail: string; subject: string; bodyHtml: string }) {
  const userId = await requireUserId();
  await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { ...data, status: "MODIFIE" },
  });
  revalidatePath("/a-valider");
}

export async function validateAndSendNow(id: string) {
  const userId = await requireUserId();
  const email = await assertOwnedDraft(userId, id);

  // Revérification anti-spam au moment de la validation : le prospect n'a pas
  // répondu ni été blacklisté depuis la préparation du brouillon.
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: email.prospectId } });
  if (prospect.status === "A_REPONDU") {
    throw new Error("Ce prospect a répondu entre-temps : envoi annulé.");
  }

  let threadId: string | undefined;
  let inReplyToMessageId: string | undefined;
  if (email.sequenceStepId) {
    const firstSent = await prisma.emailMessage.findFirst({
      where: { prospectId: email.prospectId, direction: "OUTBOUND" },
      orderBy: { sentAt: "asc" },
    });
    threadId = firstSent?.gmailThreadId;
    inReplyToMessageId = firstSent?.gmailMessageId;
  }

  const { gmailMessageId, gmailThreadId } = await sendGmailMessage({
    userId,
    to: email.toEmail,
    subject: email.subject,
    html: email.bodyHtml,
    threadId,
    inReplyToMessageId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.scheduledEmail.update({
      where: { id },
      data: {
        status: "ENVOYE",
        sentAt: new Date(),
        validatedAt: new Date(),
        validatedBy: userId,
        gmailMessageId,
        threadId: gmailThreadId,
      },
    });
    await tx.emailThread.upsert({
      where: { gmailThreadId },
      create: { gmailThreadId, prospectId: email.prospectId, lastMessageAt: new Date() },
      update: { lastMessageAt: new Date() },
    });
    await tx.emailMessage.create({
      data: {
        userId,
        prospectId: email.prospectId,
        campaignId: email.campaignId,
        scheduledEmailId: email.id,
        direction: "OUTBOUND",
        gmailMessageId,
        gmailThreadId,
        subject: email.subject,
        bodyHtml: email.bodyHtml,
        sentAt: new Date(),
      },
    });
    await tx.prospect.update({
      where: { id: email.prospectId },
      data: { lastContactAt: new Date(), status: email.sequenceStepId ? undefined : "CONTACTE" },
    });
  });

  await logActivity(userId, "EMAIL_VALIDATED", email.prospectId, undefined, email.campaignId);
  await logActivity(userId, "EMAIL_SENT", email.prospectId, undefined, email.campaignId);
  revalidatePath("/a-valider");
  revalidatePath("/dashboard");
}

/** "Valider et programmer" : l'email partira automatiquement à l'heure prévue, sans re-validation. */
export async function validateAndSchedule(id: string) {
  const userId = await requireUserId();
  await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { status: "PROGRAMME", validatedAt: new Date(), validatedBy: userId },
  });
  await logActivity(userId, "EMAIL_VALIDATED", null);
  revalidatePath("/a-valider");
}

export async function rejectEmail(id: string, reason?: string) {
  const userId = await requireUserId();
  await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { status: "REFUSE", failReason: reason ?? "Refusé manuellement" },
  });
  await logActivity(userId, "EMAIL_REJECTED", null);
  revalidatePath("/a-valider");
}

/** Reporte l'email de N heures (par défaut 24h) sans le modifier ni le refuser. */
export async function postponeEmail(id: string, hours = 24) {
  const userId = await requireUserId();
  const email = await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { scheduledFor: new Date(email.scheduledFor.getTime() + hours * 3600_000) },
  });
  revalidatePath("/a-valider");
}

/** Validation groupée : nécessite une confirmation explicite côté UI avant l'appel. */
export async function bulkValidateAndSend(ids: string[]) {
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    try {
      await validateAndSendNow(id);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : "Erreur" });
    }
  }
  return results;
}
