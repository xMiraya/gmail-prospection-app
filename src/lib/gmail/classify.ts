export type ReplyClassification =
  | "INTERESSE"
  | "DEMANDE_INFO"
  | "RENDEZ_VOUS"
  | "PAS_INTERESSE"
  | "A_RELANCER"
  | "AUTRE";

export const CLASSIFICATION_LABELS: Record<ReplyClassification, string> = {
  INTERESSE: "Intéressé",
  DEMANDE_INFO: "Demande d'informations",
  RENDEZ_VOUS: "Rendez-vous",
  PAS_INTERESSE: "Pas intéressé",
  A_RELANCER: "À relancer",
  AUTRE: "Autre",
};

// Classification heuristique par mots-clés (français). Volontairement simple et
// explicable plutôt qu'un appel à un modèle externe : sert uniquement à trier/prioriser
// l'inbox, jamais à décider d'un envoi automatique.
export function classifyReply(subject: string, snippet: string): ReplyClassification {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (/rendez.?vous|\brdv\b|disponib|calendrier|créneau|appel(?:le|er)?/.test(text)) return "RENDEZ_VOUS";
  if (/pas intéress|ne (?:me |nous )?contact|désabonn|\bstop\b|désinscri|plus jamais/.test(text)) return "PAS_INTERESSE";
  if (/intéress|ça m'intéresse|partant|envoyez|allons-y|top/.test(text)) return "INTERESSE";
  if (/informations?|renseignements?|détails?|tarifs?|prix|devis|comment ça marche/.test(text)) return "DEMANDE_INFO";
  if (/plus tard|rappel(?:le|ez)?-moi|pas le temps|occupé|revenez|dans (?:quelques|\d+) (?:semaines|mois|jours)/.test(text))
    return "A_RELANCER";
  return "AUTRE";
}

const TEMPLATES: Record<ReplyClassification, (firstName: string) => string> = {
  INTERESSE: (firstName) =>
    `Bonjour ${firstName},<br/><br/>Merci pour votre retour, ravi(e) que cela vous intéresse !<br/>Pour avancer, seriez-vous disponible cette semaine pour un court échange téléphonique ?<br/><br/>Bien à vous.`,
  DEMANDE_INFO: (firstName) =>
    `Bonjour ${firstName},<br/><br/>Merci pour votre message. Voici les informations demandées : [à compléter].<br/>N'hésitez pas si vous avez d'autres questions.<br/><br/>Bien à vous.`,
  RENDEZ_VOUS: (firstName) =>
    `Bonjour ${firstName},<br/><br/>Avec plaisir. Je vous propose les créneaux suivants : [à compléter].<br/>Dites-moi ce qui vous conviendrait le mieux.<br/><br/>Bien à vous.`,
  PAS_INTERESSE: (firstName) =>
    `Bonjour ${firstName},<br/><br/>Bien noté, merci pour votre retour et votre temps.<br/>Je vous souhaite une excellente continuation.<br/><br/>Bien à vous.`,
  A_RELANCER: (firstName) =>
    `Bonjour ${firstName},<br/><br/>Bien compris, je reviendrai vers vous plus tard.<br/>N'hésitez pas à me recontacter d'ici là si besoin.<br/><br/>Bien à vous.`,
  AUTRE: (firstName) =>
    `Bonjour ${firstName},<br/><br/>Merci pour votre message, je reviens vers vous rapidement.<br/><br/>Bien à vous.`,
};

/** Génère UNE proposition de réponse à éditer manuellement — jamais envoyée telle quelle. */
export function generateDraftReply(classification: ReplyClassification, firstName: string) {
  return TEMPLATES[classification](firstName || "");
}
