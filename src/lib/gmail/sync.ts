import { prisma } from "@/lib/db/prisma";
import { getGmailClientForUser } from "./client";
import { classifyReply, generateDraftReply } from "./classify";
import { createNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";

function parseFromHeader(from: string) {
  const match = from.match(/^(.*?)<(.+)>$/);
  if (match && match[1] !== undefined && match[2] !== undefined) {
    return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim().toLowerCase() };
  }
  return { name: "", email: from.trim().toLowerCase() };
}

/**
 * Synchronise la boîte Gmail réelle : récupère les messages entrants récents (30 jours),
 * les associe à un prospect existant par email, sinon crée un prospect "À vérifier"
 * automatiquement (jamais silencieusement fondu dans un prospect existant sans match
 * exact d'email). Classifie chaque nouvelle réponse et propose un brouillon de réponse —
 * rien n'est jamais envoyé ici, uniquement lu et stocké.
 * Idempotent : gmailMessageId est unique, rejouer la sync ne recrée pas de doublons.
 */
export async function syncGmailInbox(userId: string) {
  const gmail = await getGmailClientForUser(userId);
  const account = await prisma.googleAccount.findUniqueOrThrow({ where: { userId } });

  let newReplies = 0;
  const errors: string[] = [];

  try {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: "in:inbox -from:me newer_than:30d",
      maxResults: 40,
    });

    const messageIds = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

    for (const id of messageIds) {
      const existing = await prisma.emailMessage.findUnique({ where: { gmailMessageId: id } });
      if (existing) continue;

      try {
        const { data: msg } = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = msg.payload?.headers ?? [];
        const fromRaw = headers.find((h) => h.name === "From")?.value ?? "";
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "(sans objet)";
        const { name: fromName, email: fromEmail } = parseFromHeader(fromRaw);

        if (!fromEmail || fromEmail === account.email.toLowerCase()) continue;

        let prospect = await prisma.prospect.findFirst({
          where: { userId, email: { equals: fromEmail, mode: "insensitive" } },
        });

        if (!prospect) {
          const [firstName, ...rest] = (fromName || fromEmail.split("@")[0] || "Contact").split(" ");
          prospect = await prisma.prospect.create({
            data: {
              userId,
              firstName: firstName || "Contact",
              lastName: rest.join(" ") || null,
              email: fromEmail,
              source: "Réponse Gmail (auto)",
              status: "A_VERIFIER",
            },
          });
          await logActivity(userId, "PROSPECT_CREATED", prospect.id, { source: "gmail_sync" });
        }

        const gmailThreadId = msg.threadId!;
        const thread = await prisma.emailThread.upsert({
          where: { gmailThreadId },
          create: { gmailThreadId, prospectId: prospect.id, hasReply: true, lastMessageAt: new Date() },
          update: { hasReply: true, lastMessageAt: new Date() },
        });

        const snippet = msg.snippet ?? "";
        const classification = classifyReply(subject, snippet);
        const draftReply = generateDraftReply(classification, prospect.firstName);

        await prisma.emailMessage.create({
          data: {
            userId,
            prospectId: prospect.id,
            direction: "INBOUND",
            gmailMessageId: id,
            gmailThreadId,
            subject,
            snippet,
            sentAt: new Date(Number(msg.internalDate ?? Date.now())),
            classification,
            draftReply,
            draftStatus: "PENDING",
          },
        });

        newReplies++;

        const cancelled = await prisma.scheduledEmail.updateMany({
          where: { prospectId: prospect.id, status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] } },
          data: { status: "REFUSE", failReason: "Annulé automatiquement : le prospect a répondu" },
        });

        if (prospect.status !== "A_VERIFIER") {
          await prisma.prospect.update({ where: { id: prospect.id }, data: { status: "A_REPONDU", lastContactAt: new Date() } });
        } else {
          await prisma.prospect.update({ where: { id: prospect.id }, data: { lastContactAt: new Date() } });
        }

        await logActivity(userId, "REPLY_RECEIVED", prospect.id);
        await logActivity(userId, "REPLY_DETECTED", prospect.id, { gmailMessageId: id, classification });
        if (cancelled.count > 0) {
          await logActivity(userId, "FOLLOWUPS_CANCELLED", prospect.id, { count: cancelled.count });
        }

        await createNotification(userId, {
          type: "REPLY",
          title: `${prospect.firstName} a répondu`,
          message: `Nouvelle réponse Gmail classée "${classification}". Une proposition de réponse vous attend dans Réponses.`,
          link: `/reponses`,
        });

        void thread; // upsert result already applied
      } catch (err) {
        errors.push(`Message ${id}: ${err instanceof Error ? err.message : "erreur inconnue"}`);
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Erreur de synchronisation Gmail");
  }

  await prisma.googleAccount.update({
    where: { userId },
    data: {
      lastSyncAt: new Date(),
      lastSyncNewCount: newReplies,
      lastSyncError: errors.length > 0 ? errors.join(" | ") : null,
    },
  });

  return { newReplies, errors };
}
