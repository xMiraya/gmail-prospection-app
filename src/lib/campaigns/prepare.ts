import { prisma } from "@/lib/db/prisma";
import { renderTemplate } from "@/lib/templates/render";
import { computeNextSlots } from "./slots";
import { logActivity } from "@/lib/activity";
import type { Campaign, Prospect, Company, SequenceStep, EmailTemplate } from "@prisma/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function isBlacklisted(userId: string, email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  const hit = await prisma.blacklist.findFirst({
    where: {
      userId,
      OR: [{ email: email.toLowerCase() }, ...(domain ? [{ domain }] : [])],
    },
  });
  return !!hit;
}

/**
 * Prépare (mais n'envoie JAMAIS) le brouillon d'email pour une étape de séquence
 * donnée d'un prospect. Le résultat est un ScheduledEmail en statut A_VALIDER
 * (ou A_VERIFIER via missingVariables) qui doit passer par la page "À valider".
 */
export async function draftEmailForStep(params: {
  userId: string;
  campaign: Campaign;
  prospect: Prospect & { company?: Company | null };
  step: SequenceStep & { template: EmailTemplate };
  scheduledFor: Date;
}) {
  const { userId, campaign, prospect, step, scheduledFor } = params;

  const subjectResult = renderTemplate(step.template.subject, prospect);
  const bodyResult = renderTemplate(step.template.body, prospect);
  const missingVariables = Array.from(
    new Set([...subjectResult.missingVariables, ...bodyResult.missingVariables])
  );

  return prisma.scheduledEmail.create({
    data: {
      userId,
      prospectId: prospect.id,
      campaignId: campaign.id,
      sequenceStepId: step.id,
      status: "A_VALIDER",
      toEmail: prospect.email,
      subject: subjectResult.rendered,
      bodyHtml: bodyResult.rendered,
      missingVariables,
      scheduledFor,
    },
  });
}

/**
 * Point d'entrée du lancement de campagne : pour chaque prospect sélectionné,
 * ne prépare QUE le premier email de la séquence (étape 0). Les relances sont
 * préparées plus tard par `prepareDueFollowUps`, uniquement si aucune réponse
 * n'a été reçue entre-temps.
 *
 * Exclut automatiquement : emails invalides, prospects blacklistés, et
 * (sauf si `allowRecontact`) les prospects déjà contactés récemment.
 */
export async function launchCampaign(params: {
  userId: string;
  campaignId: string;
  prospectIds: string[];
  allowRecontact?: boolean;
}) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: params.campaignId },
    include: { sequence: { include: { steps: { include: { template: true }, orderBy: { order: "asc" } } } } },
  });

  if (!campaign.sequence || campaign.sequence.steps.length === 0) {
    throw new Error("La campagne n'a pas de séquence configurée");
  }
  const firstStep = campaign.sequence.steps.find((s) => s.order === 0);
  if (!firstStep) throw new Error("La séquence n'a pas d'étape initiale");

  const prospects = await prisma.prospect.findMany({
    where: { id: { in: params.prospectIds }, userId: params.userId },
    include: { company: true },
  });

  const results = { prepared: 0, skippedInvalidEmail: 0, skippedBlacklist: 0, skippedAlreadyContacted: 0 };

  // Compte déjà les créneaux existants pour ne pas dépasser la limite quotidienne
  const existingScheduled = await prisma.scheduledEmail.findMany({
    where: { userId: params.userId, status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] } },
    select: { scheduledFor: true },
  });
  const countsByDay: Record<string, number> = {};
  for (const e of existingScheduled) {
    const key = e.scheduledFor.toISOString().slice(0, 10);
    countsByDay[key] = (countsByDay[key] ?? 0) + 1;
  }

  const eligible: (Prospect & { company: Company | null })[] = [];

  for (const prospect of prospects) {
    if (!EMAIL_RE.test(prospect.email)) {
      results.skippedInvalidEmail++;
      continue;
    }
    if (await isBlacklisted(params.userId, prospect.email)) {
      results.skippedBlacklist++;
      continue;
    }
    if (prospect.status === "NE_PLUS_CONTACTER" || prospect.optOutAt) {
      results.skippedBlacklist++;
      continue;
    }
    if (!params.allowRecontact && prospect.lastContactAt) {
      results.skippedAlreadyContacted++;
      continue;
    }
    eligible.push(prospect);
  }

  const slots = computeNextSlots({
    count: eligible.length,
    from: new Date(),
    sendDays: campaign.sendDays,
    sendStartHour: campaign.sendStartHour,
    sendEndHour: campaign.sendEndHour,
    dailyLimit: campaign.dailyLimit,
    minIntervalMinutes: 3,
    alreadyScheduledCounts: countsByDay,
  });

  for (let i = 0; i < eligible.length; i++) {
    const prospect = eligible[i];
    await draftEmailForStep({
      userId: params.userId,
      campaign,
      prospect,
      step: firstStep,
      scheduledFor: slots[i],
    });
    await prisma.campaignProspect.upsert({
      where: { campaignId_prospectId: { campaignId: campaign.id, prospectId: prospect.id } },
      create: { campaignId: campaign.id, prospectId: prospect.id, currentStepOrder: 0 },
      update: { currentStepOrder: 0 },
    });
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { status: "EMAIL_PROGRAMME" },
    });
    await logActivity(params.userId, "EMAIL_SCHEDULED", prospect.id, undefined, campaign.id);
    results.prepared++;
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "ACTIVE", startedAt: campaign.startedAt ?? new Date() },
  });
  await logActivity(params.userId, "CAMPAIGN_STARTED", null, results, campaign.id);

  return results;
}

/**
 * À exécuter périodiquement (cron) : pour chaque prospect en campagne active dont
 * le délai avant la prochaine étape est écoulé, prépare la relance suivante —
 * SAUF si le prospect a répondu depuis (vérifié juste avant, jamais présumé).
 * La relance atterrit en statut A_VALIDER : elle ne part jamais sans validation,
 * sauf si la campagne est en mode AUTOMATIQUE (auquel cas le job d'envoi la
 * traitera directement une fois VALIDE).
 */
export async function prepareDueFollowUps(userId: string) {
  const campaignProspects = await prisma.campaignProspect.findMany({
    where: {
      campaign: { userId, status: "ACTIVE" },
      prospect: { status: { notIn: ["A_REPONDU", "NE_PLUS_CONTACTER", "CLIENT", "PAS_INTERESSE"] } },
    },
    include: {
      campaign: { include: { sequence: { include: { steps: { include: { template: true }, orderBy: { order: "asc" } } } } } },
      prospect: { include: { company: true } },
    },
  });

  let prepared = 0;

  for (const cp of campaignProspects) {
    const steps = cp.campaign.sequence?.steps ?? [];
    const nextStep = steps.find((s) => s.order === cp.currentStepOrder + 1);
    if (!nextStep) continue;

    // Ne jamais relancer sans revérifier qu'aucune réponse n'est arrivée entre-temps.
    const hasReplied = await prisma.emailThread.findFirst({
      where: { prospectId: cp.prospectId, hasReply: true },
    });
    if (hasReplied) continue;

    const lastSent = await prisma.scheduledEmail.findFirst({
      where: { prospectId: cp.prospectId, campaignId: cp.campaignId, status: "ENVOYE" },
      orderBy: { sentAt: "desc" },
    });
    if (!lastSent?.sentAt) continue;

    const dueDate = new Date(lastSent.sentAt.getTime() + nextStep.delayDays * 24 * 60 * 60 * 1000);
    if (dueDate > new Date()) continue;

    // Idempotence : ne pas re-préparer si un brouillon existe déjà pour cette étape.
    const alreadyDrafted = await prisma.scheduledEmail.findFirst({
      where: { prospectId: cp.prospectId, sequenceStepId: nextStep.id },
    });
    if (alreadyDrafted) continue;

    const scheduledFor = new Date();
    scheduledFor.setHours(nextStep.approxHour, 0, 0, 0);
    if (scheduledFor < new Date()) scheduledFor.setDate(scheduledFor.getDate() + 1);

    await draftEmailForStep({
      userId,
      campaign: cp.campaign,
      prospect: cp.prospect,
      step: nextStep,
      scheduledFor,
    });

    await prisma.campaignProspect.update({
      where: { campaignId_prospectId: { campaignId: cp.campaignId, prospectId: cp.prospectId } },
      data: { currentStepOrder: nextStep.order },
    });

    const relanceStatus = nextStep.order === 1 ? "RELANCE_1" : nextStep.order === 2 ? "RELANCE_2" : "RELANCE_3";
    await prisma.prospect.update({
      where: { id: cp.prospectId },
      data: { status: relanceStatus },
    });

    await logActivity(userId, "EMAIL_SCHEDULED", cp.prospectId, { step: nextStep.order }, cp.campaignId);
    prepared++;
  }

  return { prepared };
}
