import { describe, it, expect, beforeEach } from "vitest";
import { generateDraftReply } from "@/lib/gmail/draft";

const baseCtx = {
  prospectFirstName: "Marie",
  prospectLastName: "Durand",
  companyName: "Corse Immobilier",
  campaignName: "Prospection sites internet",
  threadHistory: [],
};

describe("generateDraftReply (no AI provider configured)", () => {
  beforeEach(() => {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("never claims to be AI-generated when no provider is configured", async () => {
    const result = await generateDraftReply({
      ...baseCtx,
      classification: "INTERESSE",
      incomingSubject: "Re: proposition",
      incomingBody: "Oui ça m'intéresse",
    });
    expect(result.source).toBe("rules");
  });

  it("flags price requests as needing information instead of inventing a price", async () => {
    const result = await generateDraftReply({
      ...baseCtx,
      classification: "DEMANDE_PRIX",
      incomingSubject: "Question tarifs",
      incomingBody: "Quel est le prix ?",
    });
    expect(result.needsInfo).toBe(true);
    expect(result.body).toContain("à compléter");
    expect(result.body).not.toMatch(/\d+\s?€/); // no invented numeric price
  });

  it("produces different replies for different classifications (not repetitive)", async () => {
    const interested = await generateDraftReply({
      ...baseCtx,
      classification: "INTERESSE",
      incomingSubject: "Re: proposition",
      incomingBody: "Oui ça m'intéresse",
    });
    const rdv = await generateDraftReply({
      ...baseCtx,
      classification: "DEMANDE_RDV",
      incomingSubject: "Disponibilité",
      incomingBody: "La semaine prochaine je suis disponible",
    });
    const dejaEquipe = await generateDraftReply({
      ...baseCtx,
      classification: "DEJA_EQUIPE",
      incomingSubject: "Non merci",
      incomingBody: "Nous avons déjà un prestataire",
    });
    expect(interested.body).not.toBe(rdv.body);
    expect(rdv.body).not.toBe(dejaEquipe.body);
    expect(interested.body).not.toBe(dejaEquipe.body);
  });

  it("keeps the already-equipped reply short and non-insistent", async () => {
    const result = await generateDraftReply({
      ...baseCtx,
      classification: "DEJA_EQUIPE",
      incomingSubject: "Non merci",
      incomingBody: "Nous avons déjà un prestataire",
    });
    expect(result.body.length).toBeLessThan(300);
  });
});
