import { describe, it, expect, vi } from "vitest";
import type { Prospect, ScheduledEmail } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    blacklist: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

const { assertSendable, hasUnresolvedVariables } = await import("@/lib/queue/guards");
const { prisma } = await import("@/lib/db/prisma");

function makeEmail(overrides: Partial<ScheduledEmail> = {}): ScheduledEmail {
  return {
    id: "e1",
    userId: "u1",
    prospectId: "p1",
    campaignId: null,
    sequenceStepId: null,
    status: "VALIDE",
    toEmail: "prospect@exemple.fr",
    subject: "Bonjour",
    bodyHtml: "<p>Bonjour Julie</p>",
    missingVariables: [],
    scheduledFor: new Date(),
    validatedAt: new Date(),
    validatedBy: "u1",
    sentAt: null,
    failReason: null,
    threadId: null,
    gmailMessageId: null,
    lockedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ScheduledEmail;
}

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: "p1",
    userId: "u1",
    firstName: "Julie",
    lastName: "Martin",
    email: "prospect@exemple.fr",
    phone: null,
    website: null,
    sector: null,
    city: null,
    country: null,
    linkedinUrl: null,
    source: null,
    notes: null,
    companyId: null,
    status: "EMAIL_PROGRAMME",
    lastContactAt: null,
    nextFollowUpAt: null,
    optOutAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Prospect;
}

describe("hasUnresolvedVariables", () => {
  it("détecte une variable non remplacée", () => {
    expect(hasUnresolvedVariables("Bonjour {{prenom}}", "corps")).toBe(true);
    expect(hasUnresolvedVariables("Bonjour Julie", "corps sans variable")).toBe(false);
  });
});

describe("assertSendable — règle absolue : pas d'envoi sans validation", () => {
  it("bloque un email BROUILLON", async () => {
    const res = await assertSendable(makeEmail({ status: "BROUILLON" }), makeProspect());
    expect(res.ok).toBe(false);
  });

  it("bloque un email A_VALIDER", async () => {
    const res = await assertSendable(makeEmail({ status: "A_VALIDER" }), makeProspect());
    expect(res.ok).toBe(false);
  });

  it("bloque un email MODIFIE (non re-validé)", async () => {
    const res = await assertSendable(makeEmail({ status: "MODIFIE" }), makeProspect());
    expect(res.ok).toBe(false);
  });

  it("bloque un email REFUSE", async () => {
    const res = await assertSendable(makeEmail({ status: "REFUSE" }), makeProspect());
    expect(res.ok).toBe(false);
  });

  it("bloque un email déjà ENVOYE (anti-double-envoi)", async () => {
    const res = await assertSendable(makeEmail({ status: "ENVOYE" }), makeProspect());
    expect(res.ok).toBe(false);
  });

  it("autorise un email VALIDE avec toutes les variables résolues", async () => {
    const res = await assertSendable(makeEmail({ status: "VALIDE" }), makeProspect());
    expect(res.ok).toBe(true);
  });

  it("autorise un email PROGRAMME avec toutes les variables résolues", async () => {
    const res = await assertSendable(makeEmail({ status: "PROGRAMME" }), makeProspect());
    expect(res.ok).toBe(true);
  });

  it("bloque un email VALIDE contenant encore une variable non résolue", async () => {
    const res = await assertSendable(
      makeEmail({ status: "VALIDE", bodyHtml: "Bonjour {{prenom}}" }),
      makeProspect()
    );
    expect(res.ok).toBe(false);
  });

  it("bloque si le prospect a répondu entre-temps", async () => {
    const res = await assertSendable(makeEmail({ status: "VALIDE" }), makeProspect({ status: "A_REPONDU" }));
    expect(res.ok).toBe(false);
  });

  it("bloque si le prospect est \"Ne plus contacter\"", async () => {
    const res = await assertSendable(
      makeEmail({ status: "VALIDE" }),
      makeProspect({ status: "NE_PLUS_CONTACTER" })
    );
    expect(res.ok).toBe(false);
  });

  it("bloque si le prospect a une date d'opposition (opt-out RGPD)", async () => {
    const res = await assertSendable(makeEmail({ status: "VALIDE" }), makeProspect({ optOutAt: new Date() }));
    expect(res.ok).toBe(false);
  });

  it("bloque si l'adresse est blacklistée", async () => {
    vi.mocked(prisma.blacklist.findFirst).mockResolvedValueOnce({ id: "b1" } as never);
    const res = await assertSendable(makeEmail({ status: "VALIDE" }), makeProspect());
    expect(res.ok).toBe(false);
  });
});
