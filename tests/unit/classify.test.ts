import { describe, it, expect } from "vitest";
import { classifyReply } from "@/lib/gmail/classify";

describe("classifyReply", () => {
  it("detects interest and a request for more information", () => {
    expect(
      classifyReply("Re: proposition", "Oui, votre proposition m'intéresse, pouvez-vous m'envoyer plus d'informations ?")
    ).toBe("INTERESSE");
  });

  it("detects an implicit meeting request from an availability answer", () => {
    expect(classifyReply("Re: disponibilité", "Je ne suis pas disponible cette semaine mais la semaine prochaine oui")).toBe(
      "DEMANDE_RDV"
    );
  });

  it("detects a price request", () => {
    expect(classifyReply("Question", "Quel est le prix de votre offre ?")).toBe("DEMANDE_PRIX");
  });

  it("detects an already-equipped refusal", () => {
    expect(classifyReply("Non merci", "Nous avons déjà un prestataire pour ça")).toBe("DEJA_EQUIPE");
  });

  it("detects a plain refusal", () => {
    expect(classifyReply("Non", "Pas intéressé, merci de ne plus me contacter")).toBe("PAS_INTERESSE");
  });

  it("detects an information request", () => {
    expect(classifyReply("Question", "Pouvez-vous m'en dire plus sur votre service ?")).toBe("DEMANDE_INFO");
  });

  it("detects an out-of-office auto-reply", () => {
    expect(classifyReply("Réponse automatique", "Je suis actuellement absent du bureau, de retour lundi")).toBe(
      "REPONSE_AUTOMATIQUE"
    );
  });

  it("falls back to A_ANALYSER when nothing matches", () => {
    expect(classifyReply("Bonjour", "Ceci est un message neutre sans signal particulier")).toBe("A_ANALYSER");
  });
});

describe("computeImportanceScore", () => {
  it("scores a meeting request as near-top priority", async () => {
    const { computeImportanceScore } = await import("@/lib/gmail/classify");
    expect(computeImportanceScore("DEMANDE_RDV", 80)).toBe(95);
  });

  it("never lets a filtered ad type score high even if misclassified downstream", async () => {
    const { computeImportanceScore } = await import("@/lib/gmail/classify");
    expect(computeImportanceScore("REPONSE_AUTOMATIQUE", 5)).toBeLessThan(50);
  });
});
