import { prisma } from "@/lib/db/prisma";
import { getGmailClientForUser } from "./client";
import { createNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { classifyInboundEmail, extractPlainTextBody } from "./classify";
import { maybeDraftAiReply } from "@/lib/ai/generateReply";

/**
 * Synchronise les réponses Gmail pour un utilisateur :
 * - récupère les nouveaux messages des threads suivis (ceux liés à un prospect)
 * - classe chaque message entrant : vraie réponse / réponse automatique / pub-newsletter
 * - pour une vraie réponse : marque le prospect "A_REPONDU", annule ses relances
 *   programmées non envoyées, et propose un brouillon de réponse (si l'IA est configurée)
 * - pour une pub/newsletter/réponse automatique : trace le message mais ne déclenche
 *   aucune relance annulée, aucun changement de statut, aucune notification — il est
 *   simplement classé "ignoré"
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
  let newIgnored = 0;

  for (const thread of threads) {
    const { data } = await gmail.users.threads.get({
      userId: "me",
      id: thread.gmailThreadId,
      format: "full",
    });

    const messages = data.messages ?? [];
    for (const msg of messages) {
      const existing = await prisma.emailMessage.findUnique({
        where: { gmailMessageId: msg.id! },
      });
      if (existing) continue;

      const headers = msg.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;

      const from = header("From") ?? "";
      const subject = header("Subject") ?? "";
      const isFromProspect = from.toLowerCase().includes(thread.prospect.email.toLowerCase());
      const isFromUs = from.toLowerCase().includes(account.email.toLowerCase());

      if (!isFromProspect || isFromUs) continue;

      const bodyText = extractPlainTextBody(msg.payload);
      const category = classifyInboundEmail({
        fromHeader: from,
        subject,
        listUnsubscribe: header("List-Unsubscribe"),
        precedence: header("Precedence"),
        autoSubmitted: header("Auto-Submitted"),
        bodyText,
      });

      await prisma.emailMessage.create({
        data: {
          userId,
          prospectId: thread.prospectId,
          direction: "INBOUND",
          gmailMessageId: msg.id!,
          gmailThreadId: thread.gmailThreadId,
          subject,
          snippet: msg.snippet ?? null,
          bodyHtml: bodyText || null,
          category,
          sentAt: new Date(Number(msg.internalDate ?? Date.now())),
        },
      });

      if (category !== "REAL_REPLY") {
        // Pub, newsletter ou réponse automatique : on garde une trace du message
        // mais on ne touche ni au statut du prospect ni aux relances programmées,
        // et on ne notifie pas — il est simplement ignoré.
        newIgnored++;
        await logActivity(userId, "REPLY_DETECTED", thread.prospectId, {
          gmailMessageId: msg.id,
          category,
          ignored: true,
        });
        continue;
      }

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
      await logActivity(userId, "REPLY_DETECTED", thread.prospectId, { gmailMessageId: msg.id, category });
      if (cancelled.count > 0) {
        await logActivity(userId, "FOLLOWUPS_CANCELLED", thread.prospectId, {
          count: cancelled.count,
        });
      }

      // Propose un brouillon de réponse contextualisé (si OPENAI_API_KEY est configuré) ;
      // ne bloque jamais la synchro si la génération échoue.
      try {
        await maybeDraftAiReply({
          userId,
          prospectId: thread.prospectId,
          gmailThreadId: thread.gmailThreadId,
          toEmail: thread.prospect.email,
          incomingSubject: subject,
          incomingBody: bodyText || msg.snippet || "",
        });
      } catch (err) {
        console.error("Erreur génération brouillon de réponse IA", err);
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

  return { newReplies, newIgnored };
}
