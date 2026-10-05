import { prisma } from "@/lib/db/prisma";
import { getGmailClientForUser } from "./client";
import { classifyMessageType, VISIBLE_MESSAGE_TYPES, MESSAGE_TYPE_BASE_SCORE } from "./message-filter";
import { classifyReply, CLASSIFICATION_PRIORITY, computeImportanceScore } from "./classify";
import { generateDraftReply } from "./draft";
import { reclassifyExistingMessages } from "./reclassify";
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
 * Synchronise la boîte Gmail réelle en inbox commerciale intelligente :
 * 1. Filtre les newsletters/promos/notifications AVANT tout import (jamais de
 *    faux prospect créé pour une pub) — voir message-filter.ts.
 * 2. Pour les messages visibles, associe/crée le prospect, classe la réponse
 *    (intérêt/prix/rdv/...), puis génère une proposition de réponse contextualisée
 *    (IA si configurée, sinon un template par règles clairement identifié comme tel).
 * Rien n'est jamais envoyé ni supprimé côté Gmail. Idempotent via gmailMessageId unique.
 */
export async function syncGmailInbox(userId: string) {
  const gmail = await getGmailClientForUser(userId);
  const account = await prisma.googleAccount.findUniqueOrThrow({ where: { userId } });

  // Reclassifie au passage les messages importés avant l'ajout du filtre anti-pub
  // (messageType encore null) : les anciennes pubs Fnac/Temu disparaissent de l'UI
  // sans qu'aucune action manuelle ne soit requise. Idempotent et peu coûteux (ne
  // touche que les lignes encore non classées), donc sûr à ré-exécuter à chaque sync.
  await reclassifyExistingMessages(prisma);

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
          metadataHeaders: ["From", "Subject", "Date", "List-Unsubscribe"],
        });

        const headers = msg.payload?.headers ?? [];
        const fromRaw = headers.find((h) => h.name === "From")?.value ?? "";
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "(sans objet)";
        const hasListUnsubscribe = headers.some((h) => h.name === "List-Unsubscribe");
        const { name: fromName, email: fromEmail } = parseFromHeader(fromRaw);
        const snippet = msg.snippet ?? "";
        const gmailThreadId = msg.threadId!;
        const sentAt = new Date(Number(msg.internalDate ?? Date.now()));

        if (!fromEmail || fromEmail === account.email.toLowerCase()) continue;

        const existingProspect = await prisma.prospect.findFirst({
          where: { userId, email: { equals: fromEmail, mode: "insensitive" } },
        });
        let matchedProspect: { status: string; hasPriorOutbound: boolean } | null = null;
        if (existingProspect) {
          const priorOutbound = await prisma.emailMessage.findFirst({
            where: { prospectId: existingProspect.id, direction: "OUTBOUND" },
          });
          matchedProspect = { status: existingProspect.status, hasPriorOutbound: !!priorOutbound };
        }

        const { type: messageType, reason: filterReason } = classifyMessageType({
          fromEmail,
          fromName,
          subject,
          snippet,
          hasListUnsubscribe,
          matchedProspect,
        });
        const isVisible = VISIBLE_MESSAGE_TYPES.includes(messageType);

        if (!isVisible) {
          // Filtré : conservé pour l'onglet "Ignorés", jamais touché dans Gmail,
          // jamais transformé en prospect.
          await prisma.emailMessage.create({
            data: {
              userId,
              prospectId: null,
              direction: "INBOUND",
              gmailMessageId: id,
              gmailThreadId,
              fromEmail,
              fromName: fromName || null,
              subject,
              snippet,
              sentAt,
              messageType,
              filterReason,
              importanceScore: MESSAGE_TYPE_BASE_SCORE[messageType],
            },
          });
          continue;
        }

        let prospect = existingProspect;
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

        const company = prospect.companyId ? await prisma.company.findUnique({ where: { id: prospect.companyId } }) : null;
        const campaignLink = await prisma.campaignProspect.findFirst({
          where: { prospectId: prospect.id },
          include: { campaign: true },
          orderBy: { addedAt: "desc" },
        });
        const priorMessages = await prisma.emailMessage.findMany({
          where: { prospectId: prospect.id },
          orderBy: { sentAt: "asc" },
          take: 10,
        });

        await prisma.emailThread.upsert({
          where: { gmailThreadId },
          create: { gmailThreadId, prospectId: prospect.id, hasReply: true, lastMessageAt: new Date() },
          update: { hasReply: true, lastMessageAt: new Date() },
        });

        const classification = classifyReply(subject, snippet);
        const draft = await generateDraftReply({
          classification,
          incomingSubject: subject,
          incomingBody: snippet,
          prospectFirstName: prospect.firstName,
          prospectLastName: prospect.lastName,
          companyName: company?.name ?? null,
          campaignName: campaignLink?.campaign.name ?? null,
          threadHistory: priorMessages.map((m) => ({ direction: m.direction, subject: m.subject, snippet: m.snippet })),
        });

        await prisma.emailMessage.create({
          data: {
            userId,
            prospectId: prospect.id,
            direction: "INBOUND",
            gmailMessageId: id,
            gmailThreadId,
            fromEmail,
            fromName: fromName || null,
            subject,
            snippet,
            sentAt,
            messageType,
            filterReason,
            classification,
            priority: CLASSIFICATION_PRIORITY[classification],
            importanceScore: computeImportanceScore(classification, MESSAGE_TYPE_BASE_SCORE[messageType]),
            draftReply: draft.body,
            draftStatus: "PENDING",
            draftSource: draft.source,
            draftNeedsInfo: draft.needsInfo,
          },
        });

        newReplies++;

        const cancelled = await prisma.scheduledEmail.updateMany({
          where: { prospectId: prospect.id, status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] } },
          data: { status: "REFUSE", failReason: "Annulé automatiquement : le prospect a répondu" },
        });

        if (prospect.status !== "A_VERIFIER" && prospect.status !== "CLIENT") {
          await prisma.prospect.update({ where: { id: prospect.id }, data: { status: "A_REPONDU", lastContactAt: new Date() } });
        } else {
          await prisma.prospect.update({ where: { id: prospect.id }, data: { lastContactAt: new Date() } });
        }

        await logActivity(userId, "REPLY_RECEIVED", prospect.id);
        await logActivity(userId, "REPLY_DETECTED", prospect.id, { gmailMessageId: id, classification, messageType });
        if (cancelled.count > 0) {
          await logActivity(userId, "FOLLOWUPS_CANCELLED", prospect.id, { count: cancelled.count });
        }

        await createNotification(userId, {
          type: "REPLY",
          title: `${prospect.firstName} a répondu`,
          message: `Nouvelle réponse classée "${classification}". Une proposition de réponse vous attend dans Réponses.`,
          link: `/reponses`,
        });
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
