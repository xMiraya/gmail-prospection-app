"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { sendGmailMessage, getGmailClientForUser } from "@/lib/gmail/client";
import { syncGmailInbox } from "@/lib/gmail/sync";
import { renderTemplate } from "@/lib/templates/render";
import { revalidatePath } from "next/cache";

/** Déclenché par le bouton "Synchroniser maintenant" (Réponses / Paramètres Gmail). */
export async function triggerGmailSync() {
  const userId = await requireUserId();
  const result = await syncGmailInbox(userId);
  revalidatePath("/reponses");
  revalidatePath("/a-traiter");
  revalidatePath("/parametres/gmail");
  return result;
}

/**
 * Accepte (avec édition possible) la proposition de réponse à un message entrant :
 * crée un brouillon dans la file de validation ("À valider") — ne l'envoie JAMAIS
 * directement. L'envoi réel passe toujours par validateAndSendNow/validateAndSchedule.
 */
export async function acceptDraftReply(messageId: string, editedBody: string) {
  const userId = await requireUserId();
  const message = await prisma.emailMessage.findFirstOrThrow({ where: { id: messageId, userId } });

  const scheduled = await prisma.scheduledEmail.create({
    data: {
      userId,
      prospectId: message.prospectId,
      status: "A_VALIDER",
      toEmail: (await prisma.prospect.findUniqueOrThrow({ where: { id: message.prospectId } })).email,
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      bodyHtml: editedBody,
      scheduledFor: new Date(),
      threadId: message.gmailThreadId,
      gmailMessageId: message.gmailMessageId,
    },
  });

  await prisma.emailMessage.update({ where: { id: messageId }, data: { draftStatus: "ACCEPTED" } });
  revalidatePath("/reponses");
  revalidatePath("/a-traiter");
  revalidatePath("/a-valider");
  return scheduled.id;
}

/** Rejette la proposition de réponse : retire le message de "À traiter" sans rien envoyer. */
export async function dismissDraftReply(messageId: string) {
  const userId = await requireUserId();
  await prisma.emailMessage.updateMany({ where: { id: messageId, userId }, data: { draftStatus: "DISMISSED" } });
  revalidatePath("/reponses");
  revalidatePath("/a-traiter");
}

/** Permet de modifier le texte du brouillon proposé sans encore l'accepter. */
export async function updateDraftReply(messageId: string, body: string) {
  const userId = await requireUserId();
  await prisma.emailMessage.updateMany({ where: { id: messageId, userId }, data: { draftReply: body } });
}

export async function disconnectGmail() {
  const userId = await requireUserId();
  await prisma.googleAccount.update({ where: { userId }, data: { connected: false } });
  revalidatePath("/parametres/gmail");
}

/** Vérifie que la connexion Gmail fonctionne réellement (appel API léger, sans envoi). */
export async function testGmailConnection() {
  const userId = await requireUserId();
  const gmail = await getGmailClientForUser(userId);
  const profile = await gmail.users.getProfile({ userId: "me" });
  return { email: profile.data.emailAddress ?? null, messagesTotal: profile.data.messagesTotal ?? 0 };
}

/**
 * Mode test obligatoire (cahier des charges §31) : envoie l'email généré à partir
 * d'un template, avec un prospect fictif, UNIQUEMENT à l'adresse Gmail connectée
 * de l'utilisateur. Ne touche à aucun vrai prospect ni statut de campagne.
 */
export async function sendTestEmail(templateId: string) {
  const userId = await requireUserId();
  const account = await prisma.googleAccount.findUniqueOrThrow({ where: { userId } });
  const template = await prisma.emailTemplate.findUniqueOrThrow({ where: { id: templateId } });

  const fakeProspect = {
    id: "test",
    userId,
    firstName: "Thomas",
    lastName: "Martin",
    email: account.email,
    phone: null,
    website: "https://exemple-entreprise.fr",
    sector: "Immobilier",
    city: "Ajaccio",
    country: "France",
    linkedinUrl: null,
    source: "Test",
    notes: null,
    companyId: null,
    status: "NOUVEAU" as const,
    lastContactAt: null,
    nextFollowUpAt: null,
    optOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    company: { id: "test", userId, name: "Corse Immobilier", website: "https://exemple-entreprise.fr", sector: "Immobilier", city: "Ajaccio", country: "France", createdAt: new Date(), updatedAt: new Date() },
  };

  const subject = renderTemplate(template.subject, fakeProspect).rendered;
  const body = renderTemplate(template.body, fakeProspect).rendered;

  await sendGmailMessage({
    userId,
    to: account.email,
    subject: `[TEST] ${subject}`,
    html: body,
  });
}
