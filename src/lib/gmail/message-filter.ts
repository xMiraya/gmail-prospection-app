export type MessageType =
  | "COMMERCIAL_REPLY"
  | "LEAD_INBOUND"
  | "CLIENT_MESSAGE"
  | "NEWSLETTER"
  | "PROMOTION"
  | "TRANSACTIONAL"
  | "NOTIFICATION"
  | "SPAM_OR_IRRELEVANT"
  | "OTHER";

// Seules ces catégories apparaissent dans /reponses et /a-traiter par défaut.
export const VISIBLE_MESSAGE_TYPES: MessageType[] = ["COMMERCIAL_REPLY", "LEAD_INBOUND", "CLIENT_MESSAGE", "OTHER"];

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  COMMERCIAL_REPLY: "Réponse commerciale",
  LEAD_INBOUND: "Nouveau contact",
  CLIENT_MESSAGE: "Message client",
  NEWSLETTER: "Newsletter",
  PROMOTION: "Promotion",
  TRANSACTIONAL: "Transactionnel",
  NOTIFICATION: "Notification",
  SPAM_OR_IRRELEVANT: "Spam / non pertinent",
  OTHER: "Autre",
};

const PROMO_KEYWORDS =
  /(-\d{1,2}\s?%|\bsoldes?\b|\bpromo(?:tion)?s?\b|code promo|offre spéciale|livraison (?:offerte|gratuite)|black friday|vente flash|jusqu'à -|profitez-en)/i;
const TRANSACTIONAL_KEYWORDS =
  /(confirmation de (?:commande|réservation)|votre commande|\bfacture\b|\breçu\b|récapitulatif de commande|numéro de suivi|colis expédié|a été expédiée?)/i;
const UNSUBSCRIBE_MENTION = /se désabonner|unsubscribe|désinscri/i;
const SOCIAL_DOMAINS = ["facebookmail.com", "linkedin.com", "twitter.com", "x.com", "instagram.com", "pinterest.com"];
const NOREPLY_LOCAL = /^(no-?reply|do-?not-?reply|notifications?|alerts?)/i;
const MARKETING_LOCAL = /^(newsletter|marketing|promo|offers?|deals?)/i;

/**
 * Filtre de premier niveau (règles fiables), exécuté AVANT tout import dans l'inbox
 * commerciale. Un email jamais associé à un vrai prospect/client du CRM et portant un
 * signal publicitaire/automatique fort est masqué de l'UI (jamais supprimé de Gmail,
 * jamais transformé en faux prospect).
 */
export function classifyMessageType(input: {
  fromEmail: string;
  fromName: string;
  subject: string;
  snippet: string;
  hasListUnsubscribe: boolean;
  matchedProspect: { status: string; hasPriorOutbound: boolean } | null;
}): { type: MessageType; reason: string } {
  const { fromEmail, subject, snippet, hasListUnsubscribe, matchedProspect } = input;
  const domain = fromEmail.split("@")[1] ?? "";
  const local = fromEmail.split("@")[0] ?? "";
  const text = `${subject} ${snippet}`.toLowerCase();

  // Un expéditeur déjà connu dans le CRM prime toujours sur les heuristiques publicitaires.
  if (matchedProspect) {
    if (matchedProspect.status === "CLIENT") return { type: "CLIENT_MESSAGE", reason: "Expéditeur associé à un client existant du CRM" };
    if (matchedProspect.hasPriorOutbound)
      return { type: "COMMERCIAL_REPLY", reason: "Réponse à un email de prospection déjà envoyé à ce prospect" };
    return { type: "LEAD_INBOUND", reason: "Expéditeur associé à un prospect existant, premier contact entrant" };
  }

  if (SOCIAL_DOMAINS.some((d) => domain.endsWith(d))) return { type: "NOTIFICATION", reason: `Domaine de réseau social (${domain})` };
  if (NOREPLY_LOCAL.test(local)) return { type: "NOTIFICATION", reason: `Adresse expéditeur automatique (${local}@…)` };
  if (MARKETING_LOCAL.test(local)) {
    if (PROMO_KEYWORDS.test(text)) return { type: "PROMOTION", reason: `Adresse marketing (${local}@…) + contenu promotionnel` };
    return { type: "NEWSLETTER", reason: `Adresse expéditeur marketing (${local}@…)` };
  }

  if (hasListUnsubscribe && PROMO_KEYWORDS.test(text))
    return { type: "PROMOTION", reason: "En-tête List-Unsubscribe présent + contenu promotionnel" };
  if (hasListUnsubscribe) return { type: "NEWSLETTER", reason: "En-tête List-Unsubscribe présent (liste de diffusion)" };

  if (UNSUBSCRIBE_MENTION.test(text) && PROMO_KEYWORDS.test(text))
    return { type: "PROMOTION", reason: "Contenu promotionnel avec mention de désabonnement" };
  if (UNSUBSCRIBE_MENTION.test(text)) return { type: "NEWSLETTER", reason: "Mention de désabonnement dans le corps du message" };

  if (PROMO_KEYWORDS.test(text)) return { type: "PROMOTION", reason: "Mots-clés promotionnels détectés dans le sujet/corps" };
  if (TRANSACTIONAL_KEYWORDS.test(text))
    return { type: "TRANSACTIONAL", reason: "Contenu transactionnel (commande/facture) sans intérêt commercial" };

  // Pas de signal publicitaire/automatique fort, mais pas de lien CRM connu non plus :
  // laissé visible par défaut pour tri manuel plutôt que masqué à tort.
  return { type: "OTHER", reason: "Aucun signal publicitaire ou automatique détecté — à vérifier manuellement" };
}
