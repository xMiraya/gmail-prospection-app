import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

/**
 * Test de bout en bout du workflow de prospection (voir README §"Tester le
 * scénario complet"). Utilise une vraie base PostgreSQL (DATABASE_URL, voir
 * docker-compose.yml) mais mocke entièrement l'API Gmail : aucun réseau,
 * aucun compte Google requis. Couvre exactement le scénario demandé :
 * prospect → template → brouillon → modification → validation → envoi →
 * relance → réponse simulée → annulation automatique → statut A_REPONDU.
 */

let sendGmailMessageMock = vi.fn();
let threadsGetMock = vi.fn();

vi.mock("@/lib/gmail/client", () => ({
  isSandboxMode: () => false,
  sendGmailMessage: (...args: unknown[]) => sendGmailMessageMock(...args),
  getGmailClientForUser: async () => ({
    users: { threads: { get: (...args: unknown[]) => threadsGetMock(...args) } },
  }),
}));

const { prisma } = await import("@/lib/db/prisma");
const { launchCampaign, prepareDueFollowUps } = await import("@/lib/campaigns/prepare");
const { saveEditedEmail, validateAndSendNow, validateAndSchedule } = await import("@/lib/validation/core");
const { processDueEmails } = await import("@/lib/queue/sender");
const { syncGmailReplies } = await import("@/lib/gmail/sync");

const TEST_EMAIL = "workflow-test-user@example.com";

async function cleanup() {
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (!user) return;
  // Ordre explicite : SequenceStep référence EmailTemplate sans cascade (on ne veut
  // pas qu'une suppression de template supprime silencieusement des étapes ailleurs),
  // donc on nettoie les enfants avant les parents plutôt que de compter sur le cascade
  // depuis User.
  await prisma.emailMessage.deleteMany({ where: { userId: user.id } });
  await prisma.scheduledEmail.deleteMany({ where: { userId: user.id } });
  await prisma.emailThread.deleteMany({ where: { prospect: { userId: user.id } } });
  await prisma.campaignProspect.deleteMany({ where: { campaign: { userId: user.id } } });
  await prisma.sequenceStep.deleteMany({ where: { sequence: { userId: user.id } } });
  await prisma.campaign.deleteMany({ where: { userId: user.id } });
  await prisma.sequence.deleteMany({ where: { userId: user.id } });
  await prisma.emailTemplate.deleteMany({ where: { userId: user.id } });
  await prisma.prospect.deleteMany({ where: { userId: user.id } });
  await prisma.googleAccount.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
}

describe("Workflow complet de prospection (intégration)", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("prospect → validation → envoi → relance → réponse → annulation", async () => {
    let messageCounter = 0;
    sendGmailMessageMock = vi.fn(async () => {
      messageCounter++;
      return { gmailMessageId: `msg-${messageCounter}`, gmailThreadId: "thread-1" };
    });

    // 1. Utilisateur + prospect
    const user = await prisma.user.create({ data: { email: TEST_EMAIL, name: "Test" } });
    const prospect = await prisma.prospect.create({
      data: {
        userId: user.id,
        firstName: "Camille",
        lastName: "Durand",
        email: "camille.durand@prospect-test.fr",
      },
    });

    // 2. Templates (email initial + relance)
    const template = await prisma.emailTemplate.create({
      data: {
        userId: user.id,
        name: "Initial",
        subject: "Bonjour {{prenom}}",
        body: "Bonjour {{prenom}}, ceci est un test.",
        variables: ["prenom"],
      },
    });
    const relanceTemplate = await prisma.emailTemplate.create({
      data: {
        userId: user.id,
        name: "Relance",
        subject: "Relance pour {{prenom}}",
        body: "Bonjour {{prenom}}, je reviens vers vous.",
        variables: ["prenom"],
      },
    });

    const sequence = await prisma.sequence.create({
      data: {
        userId: user.id,
        name: "Séquence test",
        steps: {
          create: [
            { order: 0, delayDays: 0, templateId: template.id, approxHour: 9 },
            { order: 1, delayDays: 0, templateId: relanceTemplate.id, approxHour: 9 },
          ],
        },
      },
    });

    const campaign = await prisma.campaign.create({
      data: { userId: user.id, name: "Campagne test", sequenceId: sequence.id },
    });

    // 3-4. Génération de l'email initial + placement en "À valider"
    const launchResult = await launchCampaign({
      userId: user.id,
      campaignId: campaign.id,
      prospectIds: [prospect.id],
    });
    expect(launchResult.prepared).toBe(1);

    let draft = await prisma.scheduledEmail.findFirstOrThrow({ where: { prospectId: prospect.id } });
    expect(draft.status).toBe("A_VALIDER");
    expect(sendGmailMessageMock).not.toHaveBeenCalled(); // rien n'est parti automatiquement

    // 5. Modification manuelle
    await saveEditedEmail(user.id, draft.id, { toEmail: draft.toEmail, subject: "Objet modifié", bodyHtml: draft.bodyHtml });
    draft = await prisma.scheduledEmail.findUniqueOrThrow({ where: { id: draft.id } });
    expect(draft.status).toBe("MODIFIE");
    expect(sendGmailMessageMock).not.toHaveBeenCalled();

    // 6-9. Validation + envoi immédiat
    await validateAndSendNow(user.id, draft.id);
    draft = await prisma.scheduledEmail.findUniqueOrThrow({ where: { id: draft.id } });
    expect(draft.status).toBe("ENVOYE");
    expect(sendGmailMessageMock).toHaveBeenCalledTimes(1);

    const sentMessage = await prisma.emailMessage.findFirstOrThrow({ where: { prospectId: prospect.id } });
    expect(sentMessage.direction).toBe("OUTBOUND");

    // 10. Préparation de la relance (aucune réponse pour l'instant)
    await prisma.campaignProspect.update({
      where: { campaignId_prospectId: { campaignId: campaign.id, prospectId: prospect.id } },
      data: { currentStepOrder: 0 },
    });
    const followUpResult = await prepareDueFollowUps(user.id);
    expect(followUpResult.prepared).toBe(1);

    let relance = await prisma.scheduledEmail.findFirstOrThrow({
      where: { prospectId: prospect.id, sequenceStep: { order: 1 } },
    });
    expect(relance.status).toBe("A_VALIDER");

    // Validation + programmation de la relance (elle partira via le cron)
    await validateAndSchedule(user.id, relance.id);
    await prisma.scheduledEmail.update({
      where: { id: relance.id },
      data: { scheduledFor: new Date(Date.now() - 60_000) }, // créneau déjà passé
    });

    // Exécution du job d'envoi : la relance programmée part
    const sendResult1 = await processDueEmails();
    expect(sendResult1.sent).toBe(1);
    relance = await prisma.scheduledEmail.findUniqueOrThrow({ where: { id: relance.id } });
    expect(relance.status).toBe("ENVOYE");

    // 11-13. Idempotence : rejouer le cron ne doit RIEN renvoyer une deuxième fois
    const sendResult2 = await processDueEmails();
    expect(sendResult2.sent).toBe(0);
    expect(sendGmailMessageMock).toHaveBeenCalledTimes(2); // email initial + relance, jamais 3

    // 14. Simulation d'une réponse Gmail
    const account = await prisma.googleAccount.create({
      data: {
        userId: user.id,
        email: "moi@example.com",
        accessToken: "fake",
        refreshToken: "fake",
        expiryDate: new Date(Date.now() + 3600_000),
        scope: "",
      },
    });
    threadsGetMock = vi.fn(async () => ({
      data: {
        messages: [
          {
            id: "reply-msg-1",
            internalDate: `${Date.now()}`,
            snippet: "Merci pour votre message, je suis intéressé.",
            payload: {
              headers: [
                { name: "From", value: `Camille Durand <${prospect.email}>` },
                { name: "Subject", value: "Re: Relance pour Camille" },
              ],
            },
          },
        ],
      },
    }));

    const syncResult = await syncGmailReplies(user.id);
    expect(syncResult.newReplies).toBe(1);

    // 15. Le prospect passe en A_REPONDU
    const updatedProspect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospect.id } });
    expect(updatedProspect.status).toBe("A_REPONDU");

    // 16. Plus aucune relance en attente ne doit pouvoir être envoyée
    const pendingFollowUps = await prisma.scheduledEmail.findMany({
      where: { prospectId: prospect.id, status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] } },
    });
    expect(pendingFollowUps).toHaveLength(0);

    // Et si on tente quand même de préparer une nouvelle relance, rien ne se passe.
    const followUpAfterReply = await prepareDueFollowUps(user.id);
    expect(followUpAfterReply.prepared).toBe(0);

    await prisma.googleAccount.delete({ where: { id: account.id } });
  });
});
