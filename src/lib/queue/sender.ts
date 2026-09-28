import { prisma } from "@/lib/db/prisma";
import { sendGmailMessage } from "@/lib/gmail/client";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { assertSendable } from "./guards";

const LOCK_STALE_MS = 5 * 60 * 1000;

/**
 * Envoie effectivement les emails VALIDÉS dont le créneau programmé est échu.
 * NE TRAITE JAMAIS un email en statut A_VALIDER/MODIFIE/BROUILLON/REFUSE : seul
 * un email explicitement validé par l'utilisateur (VALIDE ou PROGRAMME, qui
 * signifie "validé + laissé partir à l'heure prévue") peut être envoyé ici.
 *
 * Idempotent : chaque ligne est verrouillée (lockedAt) avant traitement, et son
 * statut passe à ENVOYE/ECHEC dans la même opération que l'appel Gmail, pour
 * qu'un cron concurrent ou une deuxième exécution ne renvoie jamais le même email.
 */
export async function processDueEmails(limit = 50) {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - LOCK_STALE_MS);

  const due = await prisma.scheduledEmail.findMany({
    where: {
      status: { in: ["VALIDE", "PROGRAMME"] },
      scheduledFor: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleThreshold } }],
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  const results = { sent: 0, failed: 0, skippedLocked: 0 };

  for (const email of due) {
    // Verrouillage optimiste : si updateMany ne touche aucune ligne, un autre
    // worker a déjà pris cet email entre-temps.
    const claim = await prisma.scheduledEmail.updateMany({
      where: { id: email.id, OR: [{ lockedAt: null }, { lockedAt: { lt: staleThreshold } }] },
      data: { lockedAt: now },
    });
    if (claim.count === 0) {
      results.skippedLocked++;
      continue;
    }

    // Porte de sécurité unique (voir lib/queue/guards.ts) : re-vérifie le statut,
    // les variables non résolues, et l'état du prospect juste avant l'envoi réel.
    // C'est ELLE, et non le simple statut lu plus haut, qui autorise ou non l'appel Gmail.
    const prospect = await prisma.prospect.findUnique({ where: { id: email.prospectId } });
    const verdict = prospect ? await assertSendable(email, prospect) : { ok: false as const, reason: "Prospect introuvable" };
    if (!verdict.ok) {
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "REFUSE", failReason: verdict.reason },
      });
      await logActivity(email.userId, "EMAIL_CANCELLED", email.prospectId, { reason: verdict.reason }, email.campaignId);
      continue;
    }

    try {
      // Threading : si c'est une relance, on récupère le threadId du message initial.
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
        userId: email.userId,
        to: email.toEmail,
        subject: email.subject,
        html: email.bodyHtml,
        threadId,
        inReplyToMessageId,
      });

      await prisma.$transaction(async (tx) => {
        await tx.scheduledEmail.update({
          where: { id: email.id },
          data: { status: "ENVOYE", sentAt: new Date(), gmailMessageId, threadId: gmailThreadId },
        });

        await tx.emailThread.upsert({
          where: { gmailThreadId },
          create: { gmailThreadId, prospectId: email.prospectId, lastMessageAt: new Date() },
          update: { lastMessageAt: new Date() },
        });

        await tx.emailMessage.create({
          data: {
            userId: email.userId,
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
          data: { lastContactAt: new Date() },
        });
      });

      await logActivity(email.userId, "EMAIL_SENT", email.prospectId, undefined, email.campaignId);
      results.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      await prisma.scheduledEmail.update({
        where: { id: email.id },
        data: { status: "ECHEC", failReason: message },
      });
      await logActivity(email.userId, "EMAIL_FAILED", email.prospectId, { error: message }, email.campaignId);
      await createNotification(email.userId, {
        type: "SEND_FAILED",
        title: "Échec d'envoi",
        message: `L'email à ${email.toEmail} n'a pas pu être envoyé : ${message}`,
        link: "/a-traiter",
      });
      results.failed++;
    }
  }

  return results;
}
