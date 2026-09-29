export type ReplyClassification =
  | "INTERESSE"
  | "DEMANDE_INFO"
  | "DEMANDE_PRIX"
  | "DEMANDE_RDV"
  | "A_RAPPELER"
  | "PAS_INTERESSE"
  | "DEJA_EQUIPE"
  | "REPONSE_AUTOMATIQUE"
  | "HORS_SUJET"
  | "A_ANALYSER";

export const CLASSIFICATION_LABELS: Record<ReplyClassification, string> = {
  INTERESSE: "Intéressé",
  DEMANDE_INFO: "Demande d'informations",
  DEMANDE_PRIX: "Demande de prix",
  DEMANDE_RDV: "Demande de rendez-vous",
  A_RAPPELER: "À rappeler",
  PAS_INTERESSE: "Pas intéressé",
  DEJA_EQUIPE: "Déjà équipé / prestataire existant",
  REPONSE_AUTOMATIQUE: "Réponse automatique",
  HORS_SUJET: "Hors sujet",
  A_ANALYSER: "À analyser",
};

// Plus petit = plus prioritaire, utilisé pour trier "À traiter".
export const CLASSIFICATION_PRIORITY: Record<ReplyClassification, number> = {
  DEMANDE_RDV: 1,
  INTERESSE: 2,
  DEMANDE_PRIX: 3,
  DEMANDE_INFO: 4,
  A_RAPPELER: 5,
  A_ANALYSER: 6,
  DEJA_EQUIPE: 7,
  HORS_SUJET: 8,
  PAS_INTERESSE: 9,
  REPONSE_AUTOMATIQUE: 10,
};

// Classification heuristique par mots-clés (français). Volontairement explicable
// plutôt qu'un modèle externe : détermine la priorité et influence la proposition
// de réponse, mais ne décide jamais d'un envoi.
export function classifyReply(subject: string, snippet: string): ReplyClassification {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (/absent(e)? du bureau|out of office|réponse automatique|auto-?reply|je suis actuellement absent|en congé/.test(text))
    return "REPONSE_AUTOMATIQUE";
  if (/rendez.?vous|\brdv\b|disponib|calendrier|créneau|appel(?:le|er)?|visio/.test(text)) return "DEMANDE_RDV";
  if (/tarifs?|\bprix\b|devis|combien (?:ça|ca) coûte|coût|budget/.test(text)) return "DEMANDE_PRIX";
  if (/déjà (?:un |une )?(?:prestataire|fournisseur|solution|partenaire|agence)|on travaille déjà avec|nous avons déjà/.test(text))
    return "DEJA_EQUIPE";
  if (/pas intéress|ne (?:me |nous )?contact|désabonn|\bstop\b|désinscri|plus jamais|non merci/.test(text)) return "PAS_INTERESSE";
  if (/intéress|ça m'intéresse|partant|envoyez|allons-y|\btop\b|carrément/.test(text)) return "INTERESSE";
  if (/informations?|renseignements?|détails?|comment ça marche|en (?:savoir|dire) plus|m'en dire plus/.test(text)) return "DEMANDE_INFO";
  if (/plus tard|rappel(?:le|ez)?-moi|pas le temps|occupé|revenez|dans (?:quelques|\d+) (?:semaines|mois|jours)/.test(text))
    return "A_RAPPELER";
  return "A_ANALYSER";
}
