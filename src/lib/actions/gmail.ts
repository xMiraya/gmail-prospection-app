"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { sendGmailMessage, getGmailClientForUser } from "@/lib/gmail/client";
import { renderTemplate } from "@/lib/templates/render";
import { revalidatePath } from "next/cache";

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
