import { prisma } from "@/lib/db/prisma";
import { sendGmailMessage } from "@/lib/gmail/client";
import { hasUnresolvedVariables } from "@/lib/queue/guards";
import { isBlacklisted } from "@/lib/campaigns/prepare";
import { logActivity } from "@/lib/activity";

/**
 * Coeur du principe "l'automatisation prépare, moi je décide" : ces fonctions sont
 * les SEULES portes de sortie d'un ScheduledEmail hors de la file de validation.
 * Aucun email n'est jamais envoyé par un autre chemin que "Valider et envoyer"
 * (immédiat) ou "Valider et programmer" (le job cron l'enverra à l'heure prévue,
 * mais uniquement parce qu'il est déjà passé au statut VALIDE/PROGRAMME).
 *
 * Volontairement séparé de src/lib/actions/validation.ts (Server Actions "use
 * server", qui lisent la session HTTP) pour rester testable directement avec
 * un userId explicite, sans mock de next-auth.
 */

export async function assertOwnedDraft(userId: string, id: string) {
  const email = await prisma.scheduledEmail.findFirst({ where: { id, userId } });
  if (!email) throw new Error("Email introuvable");
  if (email.status === "ENVOYE") throw new Error("Cet email a déjà été envoyé");
  return email;
}

export async function saveEditedEmail(
  userId: string,
  id: string,
  data: { toEmail: string; subject: string; bodyHtml: string }
) {
  await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({ where: { id }, data: { ...data, status: "MODIFIE" } });
  await logActivity(userId, "EMAIL_EDITED", null);
}

/**
 * Vérifications bloquantes appliquées avant TOUT envoi déclenché depuis la page
 * "À valider" (individuel ou groupé) : variables non résolues, réponse reçue
 * depuis la préparation du brouillon, ou prospect blacklisté / "Ne plus contacter".
 * Lève une erreur explicite si l'envoi doit être bloqué.
 */
export async function assertCanSendDraft(email: {
  subject: string;
  bodyHtml: string;
  prospectId: string;
  toEmail: string;
}) {
  if (hasUnresolvedVariables(email.subject, email.bodyHtml)) {
    throw new Error("Le message contient encore des variables non remplacées ({{...}}) : envoi bloqué.");
  }
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: email.prospectId } });
  if (prospect.status === "A_REPONDU") {
    throw new Error("Ce prospect a répondu entre-temps : envoi annulé.");
  }
  if (prospect.status === "NE_PLUS_CONTACTER" || prospect.optOutAt) {
    throw new Error('Ce prospect est sur la liste "Ne plus contacter" : envoi bloqué.');
  }
  if (await isBlacklisted(prospect.userId, email.toEmail)) {
    throw new Error("Cette adresse ou ce domaine est blacklisté : envoi bloqué.");
  }
  return prospect;
}

export async function validateAndSendNow(userId: string, id: string) {
  const email = await assertOwnedDraft(userId, id);
  await assertCanSendDraft(email);

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

  await logActivity(userId, "EMAIL_APPROVED", email.prospectId, undefined, email.campaignId);
  await logActivity(userId, "EMAIL_SENT", email.prospectId, undefined, email.campaignId);
}

/** "Valider et programmer" : l'email partira automatiquement à l'heure prévue, sans re-validation. */
export async function validateAndSchedule(userId: string, id: string) {
  const email = await assertOwnedDraft(userId, id);
  await assertCanSendDraft(email);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { status: "PROGRAMME", validatedAt: new Date(), validatedBy: userId },
  });
  await logActivity(userId, "EMAIL_APPROVED", email.prospectId, undefined, email.campaignId);
}

export async function rejectEmail(userId: string, id: string, reason?: string) {
  await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { status: "REFUSE", failReason: reason ?? "Refusé manuellement" },
  });
  await logActivity(userId, "EMAIL_REJECTED", null);
}

/** Reporte l'email de N heures (par défaut 24h) sans le modifier ni le refuser. */
export async function postponeEmail(userId: string, id: string, hours = 24) {
  const email = await assertOwnedDraft(userId, id);
  await prisma.scheduledEmail.update({
    where: { id },
    data: { scheduledFor: new Date(email.scheduledFor.getTime() + hours * 3600_000) },
  });
}

export type BulkValidationSummary = {
  count: number;
  recipients: string[];
  campaigns: string[];
  modifiedCount: number;
  blockers: { id: string; toEmail: string; reason: string }[];
};

/**
 * Résumé obligatoire avant toute validation groupée (cahier des charges §9) :
 * calcule les blocages (variables manquantes, adresse invalide, blacklist,
 * prospect ayant répondu, "Ne plus contacter") SANS rien envoyer.
 */
export async function getBulkValidationSummary(userId: string, ids: string[]): Promise<BulkValidationSummary> {
  const emails = await prisma.scheduledEmail.findMany({
    where: { id: { in: ids }, userId },
    include: { prospect: true, campaign: true },
  });

  const blockers: BulkValidationSummary["blockers"] = [];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const email of emails) {
    if (hasUnresolvedVariables(email.subject, email.bodyHtml)) {
      blockers.push({ id: email.id, toEmail: email.toEmail, reason: "Variables manquantes" });
    } else if (!EMAIL_RE.test(email.toEmail)) {
      blockers.push({ id: email.id, toEmail: email.toEmail, reason: "Adresse email invalide" });
    } else if (email.prospect.status === "A_REPONDU") {
      blockers.push({ id: email.id, toEmail: email.toEmail, reason: "Le prospect a déjà répondu" });
    } else if (email.prospect.status === "NE_PLUS_CONTACTER" || email.prospect.optOutAt) {
      blockers.push({ id: email.id, toEmail: email.toEmail, reason: 'Prospect "Ne plus contacter"' });
    } else if (await isBlacklisted(userId, email.toEmail)) {
      blockers.push({ id: email.id, toEmail: email.toEmail, reason: "Adresse/domaine blacklisté" });
    }
  }

  return {
    count: emails.length,
    recipients: emails.map((e) => e.toEmail),
    campaigns: Array.from(new Set(emails.map((e) => e.campaign?.name).filter((n): n is string => !!n))),
    modifiedCount: emails.filter((e) => e.status === "MODIFIE").length,
    blockers,
  };
}

/**
 * Validation groupée : n'envoie RIEN si le lot contient le moindre blocage
 * (variables manquantes, adresse invalide, blacklist, réponse reçue, opt-out).
 * L'utilisateur doit retirer ces emails de la sélection avant de pouvoir
 * relancer la validation groupée sur le reste.
 */
export async function bulkValidateAndSend(userId: string, ids: string[]) {
  const summary = await getBulkValidationSummary(userId, ids);
  if (summary.blockers.length > 0) {
    throw new Error(
      `Validation groupée annulée : ${summary.blockers.length} email(s) comportent un blocage. Retirez-les de la sélection.`
    );
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    try {
      await validateAndSendNow(userId, id);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof Error ? err.message : "Erreur" });
    }
  }
  return results;
}
