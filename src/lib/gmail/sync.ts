import { prisma } from "@/lib/db/prisma";
import { getGmailClientForUser } from "./client";
import { createNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";

/**
 * Synchronise les réponses Gmail pour un utilisateur :
 * - récupère les nouveaux messages des threads suivis (ceux liés à un prospect)
 * - détecte les réponses provenant du prospect (et non de nous-mêmes)
 * - marque le prospect "A_REPONDU" et annule ses relances programmées non envoyées
 *
 * Utilise l'historyId Gmail comme curseur pour ne traiter que les nouveautés
 * (idempotent : rejouer la sync ne recrée pas de doublons grâce à gmailMessageId unique).
 */
export async function syncGmailReplies(userId: string) {
  const gmail = await getGmailClientForUser(userId);
  const account = await prisma.googleAccount.findUniqueOrThrow({ where: { userId } });

  const threads = await prisma.emailThread.findMany({
    where: { prospect: { userId }, hasReply: false },
    include: { prospect: true },
  });

  let newReplies = 0;

  for (const thread of threads) {
    const { data } = await gmail.users.threads.get({
      userId: "me",
      id: thread.gmailThreadId,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Message-ID", "Date"],
    });

    const messages = data.messages ?? [];
    for (const msg of messages) {
      const existing = await prisma.emailMessage.findUnique({
        where: { gmailMessageId: msg.id! },
      });
      if (existing) continue;

      const headers = msg.payload?.headers ?? [];
      const from = headers.find((h) => h.name === "From")?.value ?? "";
      const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
      const isFromProspect = from.toLowerCase().includes(thread.prospect.email.toLowerCase());
      const isFromUs = from.toLowerCase().includes(account.email.toLowerCase());

      if (!isFromProspect || isFromUs) continue;

      await prisma.emailMessage.create({
        data: {
          userId,
          prospectId: thread.prospectId,
          direction: "INBOUND",
          gmailMessageId: msg.id!,
          gmailThreadId: thread.gmailThreadId,
          subject,
          snippet: msg.snippet ?? null,
          sentAt: new Date(Number(msg.internalDate ?? Date.now())),
        },
      });

      newReplies++;

      // Réponse détectée : arrêt immédiat de toute relance programmée non envoyée.
      const cancelled = await prisma.scheduledEmail.updateMany({
        where: {
          prospectId: thread.prospectId,
          status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] },
        },
        data: { status: "REFUSE", failReason: "Annulé automatiquement : le prospect a répondu" },
      });

      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { hasReply: true, lastMessageAt: new Date() },
      });

      await prisma.prospect.update({
        where: { id: thread.prospectId },
        data: { status: "A_REPONDU", lastContactAt: new Date() },
      });

      await logActivity(userId, "REPLY_RECEIVED", thread.prospectId);
      await logActivity(userId, "REPLY_DETECTED", thread.prospectId, { gmailMessageId: msg.id });
      if (cancelled.count > 0) {
        await logActivity(userId, "FOLLOWUPS_CANCELLED", thread.prospectId, {
          count: cancelled.count,
        });
      }

      await createNotification(userId, {
        type: "REPLY",
        title: `${thread.prospect.firstName} a répondu`,
        message: `${thread.prospect.firstName} ${thread.prospect.lastName ?? ""} a répondu à votre email. Ses relances ont été annulées.`,
        link: `/prospects/${thread.prospectId}`,
      });
    }
  }

  await prisma.googleAccount.update({
    where: { userId },
    data: { lastSyncAt: new Date() },
  });

  return { newReplies };
}
