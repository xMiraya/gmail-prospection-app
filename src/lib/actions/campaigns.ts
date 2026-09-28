"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { launchCampaign, isBlacklisted } from "@/lib/campaigns/prepare";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createCampaign(formData: FormData) {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.create({
    data: {
      userId,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      sequenceId: String(formData.get("sequenceId") ?? "") || null,
      dailyLimit: Number(formData.get("dailyLimit") ?? 25),
      sendStartHour: Number(formData.get("sendStartHour") ?? 9),
      sendEndHour: Number(formData.get("sendEndHour") ?? 17),
      automationMode: (String(formData.get("automationMode") ?? "MANUEL")) as never,
    },
  });
  redirect(`/campagnes/${campaign.id}`);
}

/** Récapitulatif obligatoire avant lancement (cahier des charges §30). */
export async function getCampaignValidationSummary(campaignId: string, prospectIds: string[]) {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const prospects = await prisma.prospect.findMany({ where: { id: { in: prospectIds }, userId } });

  let validEmails = 0;
  let invalidEmails = 0;
  let alreadyContacted = 0;
  let blacklisted = 0;

  for (const p of prospects) {
    if (!EMAIL_RE.test(p.email)) {
      invalidEmails++;
      continue;
    }
    if (await isBlacklisted(userId, p.email) || p.status === "NE_PLUS_CONTACTER") {
      blacklisted++;
      continue;
    }
    if (p.lastContactAt) {
      alreadyContacted++;
      continue;
    }
    validEmails++;
  }

  return {
    campaignName: campaign.name,
    totalProspects: prospects.length,
    validEmails,
    invalidEmails,
    alreadyContacted,
    blacklisted,
    dailyLimit: campaign.dailyLimit,
    scheduledToday: Math.min(validEmails, campaign.dailyLimit),
    scheduledLater: Math.max(0, validEmails - campaign.dailyLimit),
  };
}

export type NewCampaignInput = {
  name: string;
  description?: string;
  sequenceId: string;
  dailyLimit: number;
  sendStartHour: number;
  sendEndHour: number;
  sendDays: number[];
  automationMode: "MANUEL" | "SEMI_AUTOMATIQUE" | "AUTOMATIQUE";
};

/**
 * Récapitulatif de l'étape 5 du wizard de création de campagne, calculé AVANT
 * toute création en base (aucune campagne ni aucun brouillon n'existe encore
 * à ce stade). Utilise les mêmes règles que getCampaignValidationSummary.
 */
export async function getNewCampaignSummary(prospectIds: string[], dailyLimit: number) {
  const userId = await requireUserId();
  const prospects = await prisma.prospect.findMany({ where: { id: { in: prospectIds }, userId } });

  let validEmails = 0;
  let invalidEmails = 0;
  let alreadyContacted = 0;
  let blacklisted = 0;

  for (const p of prospects) {
    if (!EMAIL_RE.test(p.email)) {
      invalidEmails++;
      continue;
    }
    if (await isBlacklisted(userId, p.email) || p.status === "NE_PLUS_CONTACTER") {
      blacklisted++;
      continue;
    }
    if (p.lastContactAt) {
      alreadyContacted++;
      continue;
    }
    validEmails++;
  }

  return {
    totalProspects: prospects.length,
    validEmails,
    invalidEmails,
    alreadyContacted,
    blacklisted,
    dailyLimit,
    scheduledToday: Math.min(validEmails, dailyLimit),
    scheduledLater: Math.max(0, validEmails - dailyLimit),
  };
}

/**
 * Point final du wizard de création de campagne : crée la campagne PUIS prépare
 * (via launchCampaign, déjà utilisé ailleurs) les premiers emails en statut
 * A_VALIDER. Aucun email n'est envoyé ici — ils atterrissent tous dans "À valider".
 */
export async function createCampaignAndPrepare(input: NewCampaignInput, prospectIds: string[]) {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.create({
    data: {
      userId,
      name: input.name,
      description: input.description || null,
      sequenceId: input.sequenceId,
      dailyLimit: input.dailyLimit,
      sendStartHour: input.sendStartHour,
      sendEndHour: input.sendEndHour,
      sendDays: input.sendDays,
      automationMode: input.automationMode,
    },
  });
  const result = await launchCampaign({ userId, campaignId: campaign.id, prospectIds });
  revalidatePath("/campagnes");
  revalidatePath("/a-valider");
  return { campaignId: campaign.id, ...result };
}

export async function launchCampaignAction(campaignId: string, prospectIds: string[]) {
  const userId = await requireUserId();
  const result = await launchCampaign({ userId, campaignId, prospectIds });
  revalidatePath(`/campagnes/${campaignId}`);
  revalidatePath("/a-valider");
  return result;
}

export async function setCampaignStatus(campaignId: string, status: "EN_PAUSE" | "ACTIVE" | "TERMINEE") {
  const userId = await requireUserId();
  await prisma.campaign.update({
    where: { id: campaignId, userId },
    data: { status, ...(status === "TERMINEE" ? { finishedAt: new Date() } : {}) },
  });
  await logActivity(
    userId,
    status === "EN_PAUSE" ? "CAMPAIGN_PAUSED" : status === "TERMINEE" ? "CAMPAIGN_FINISHED" : "CAMPAIGN_STARTED",
    null,
    undefined,
    campaignId
  );
  revalidatePath(`/campagnes/${campaignId}`);
}
