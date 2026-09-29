import { describe, it, expect } from "vitest";
import { classifyMessageType, VISIBLE_MESSAGE_TYPES } from "@/lib/gmail/message-filter";

describe("classifyMessageType", () => {
  it("filters a Fnac-style newsletter", () => {
    const r = classifyMessageType({
      fromEmail: "newsletter@fnac.com",
      fromName: "Fnac",
      subject: "Nos meilleures offres de la semaine",
      snippet: "Découvrez -20% sur une sélection de produits, se désabonner en bas de page",
      hasListUnsubscribe: true,
      matchedProspect: null,
    });
    expect(VISIBLE_MESSAGE_TYPES).not.toContain(r.type);
  });

  it("filters a Temu-style promo", () => {
    const r = classifyMessageType({
      fromEmail: "promo@temu.com",
      fromName: "Temu",
      subject: "Jusqu'à -70% aujourd'hui seulement !",
      snippet: "Profitez-en, livraison gratuite, code promo TEMU10",
      hasListUnsubscribe: true,
      matchedProspect: null,
    });
    expect(r.type).toBe("PROMOTION");
    expect(VISIBLE_MESSAGE_TYPES).not.toContain(r.type);
  });

  it("filters no-reply system notifications", () => {
    const r = classifyMessageType({
      fromEmail: "no-reply@service.com",
      fromName: "",
      subject: "Votre code de vérification",
      snippet: "123456",
      hasListUnsubscribe: false,
      matchedProspect: null,
    });
    expect(r.type).toBe("NOTIFICATION");
    expect(VISIBLE_MESSAGE_TYPES).not.toContain(r.type);
  });

  it("filters order confirmations (transactional, no commercial interest)", () => {
    const r = classifyMessageType({
      fromEmail: "commandes@boutique.fr",
      fromName: "Boutique en ligne",
      subject: "Confirmation de commande #12345",
      snippet: "Votre commande a été expédiée, numéro de suivi FR123456789",
      hasListUnsubscribe: false,
      matchedProspect: null,
    });
    expect(r.type).toBe("TRANSACTIONAL");
    expect(VISIBLE_MESSAGE_TYPES).not.toContain(r.type);
  });

  it("keeps a reply from a known prospect visible as COMMERCIAL_REPLY", () => {
    const r = classifyMessageType({
      fromEmail: "jean@entreprise.fr",
      fromName: "Jean Dupont",
      subject: "Re: Votre proposition",
      snippet: "Oui ça m'intéresse, envoyez-moi plus d'infos",
      hasListUnsubscribe: false,
      matchedProspect: { status: "CONTACTE", hasPriorOutbound: true },
    });
    expect(r.type).toBe("COMMERCIAL_REPLY");
    expect(VISIBLE_MESSAGE_TYPES).toContain(r.type);
  });

  it("classifies a first-time message from a known prospect as LEAD_INBOUND", () => {
    const r = classifyMessageType({
      fromEmail: "jean@entreprise.fr",
      fromName: "Jean Dupont",
      subject: "Question",
      snippet: "Bonjour, je suis intéressé par vos services",
      hasListUnsubscribe: false,
      matchedProspect: { status: "A_VERIFIER", hasPriorOutbound: false },
    });
    expect(r.type).toBe("LEAD_INBOUND");
    expect(VISIBLE_MESSAGE_TYPES).toContain(r.type);
  });

  it("classifies a message from a client as CLIENT_MESSAGE", () => {
    const r = classifyMessageType({
      fromEmail: "client@societe.fr",
      fromName: "Client Fidèle",
      subject: "Question sur ma facture",
      snippet: "Bonjour, une question",
      hasListUnsubscribe: false,
      matchedProspect: { status: "CLIENT", hasPriorOutbound: true },
    });
    expect(r.type).toBe("CLIENT_MESSAGE");
  });
});
