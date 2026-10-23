import { callAIProvider, hasAIProvider } from "@/lib/ai/provider";
import { CLASSIFICATION_LABELS, type ReplyClassification } from "./classify";

export type DraftContext = {
  classification: ReplyClassification;
  incomingSubject: string;
  incomingBody: string;
  prospectFirstName: string;
  prospectLastName?: string | null;
  companyName?: string | null;
  campaignName?: string | null;
  threadHistory: { direction: string; subject: string; snippet: string | null }[];
};

export type DraftResult = { body: string; source: "ai" | "rules"; needsInfo: boolean };

const NEEDS_INFO_CLASSIFICATIONS: ReplyClassification[] = ["DEMANDE_PRIX"];

const SYSTEM_PROMPT = `Tu es un assistant commercial. Tu rédiges UNE proposition de réponse email en français, courte et professionnelle, à partir du message reçu d'un prospect et du contexte CRM fourni.
RÈGLES STRICTES :
- Ne jamais inventer un prix, une date, une disponibilité, une offre, une fonctionnalité ou un engagement qui n'est pas explicitement fourni dans le contexte.
- Si une information nécessaire est absente (ex: prix), écris "[à compléter]" à cet endroit plutôt que d'inventer une valeur.
- Réponds précisément à ce que dit le message reçu, ne sois jamais générique.
- Reste courtois, professionnel, concis (5 lignes maximum).
- Ne signe jamais avec un nom inventé.
- Sortie : uniquement le corps de l'email en HTML simple (balises <br/> pour les retours à la ligne), sans objet ni introduction méta.`;

function buildUserPrompt(ctx: DraftContext): string {
  const historyText = ctx.threadHistory
    .slice(-6)
    .map((m) => `[${m.direction === "OUTBOUND" ? "Nous" : "Prospect"}] ${m.subject}: ${m.snippet ?? ""}`)
    .join("\n");

  return `Contexte CRM :
- Prospect : ${ctx.prospectFirstName} ${ctx.prospectLastName ?? ""}
- Entreprise : ${ctx.companyName ?? "inconnue"}
- Campagne : ${ctx.campaignName ?? "aucune"}
- Classification du message reçu : ${CLASSIFICATION_LABELS[ctx.classification]}

Historique du fil (le plus récent en dernier) :
${historyText || "(aucun historique)"}

Message reçu à traiter :
Objet : ${ctx.incomingSubject}
Contenu : ${ctx.incomingBody}

Rédige la proposition de réponse.`;
}

function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** Jamais présenté comme une IA : reprend le sujet reçu pour rester minimalement contextuel. */
function fallbackTemplate(ctx: DraftContext): string {
  const name = ctx.prospectFirstName || "";
  const subject = truncate(ctx.incomingSubject);
  switch (ctx.classification) {
    case "DEMANDE_RDV":
      return `Bonjour ${name},<br/><br/>Avec plaisir. Concernant votre message ("${subject}"), quel créneau vous conviendrait la semaine prochaine ?<br/><br/>Bien à vous.`;
    case "DEMANDE_PRIX":
      return `Bonjour ${name},<br/><br/>Merci pour votre demande. Le tarif exact dépend de votre besoin précis : [à compléter avant envoi].<br/>Je reviens vers vous rapidement avec un chiffrage.<br/><br/>Bien à vous.`;
    case "DEMANDE_INFO":
      return `Bonjour ${name},<br/><br/>Merci pour votre message. Pour répondre précisément à "${subject}", voici les informations : [à compléter].<br/><br/>Bien à vous.`;
    case "INTERESSE":
      return `Bonjour ${name},<br/><br/>Merci, ravi(e) que cela vous intéresse. Pour avancer, seriez-vous disponible pour un court échange ?<br/><br/>Bien à vous.`;
    case "DEJA_EQUIPE":
      return `Bonjour ${name},<br/><br/>Bien noté, merci pour votre retour honnête. Je reste disponible si la situation évolue.<br/><br/>Bien à vous.`;
    case "PAS_INTERESSE":
      return `Bonjour ${name},<br/><br/>Bien compris, merci pour votre retour et votre temps.<br/><br/>Bien à vous.`;
    case "A_RAPPELER":
      return `Bonjour ${name},<br/><br/>Bien noté, je reviendrai vers vous plus tard comme convenu.<br/><br/>Bien à vous.`;
    case "REPONSE_AUTOMATIQUE":
      return `(Réponse automatique détectée — aucune action nécessaire pour l'instant.)`;
    default:
      return `Bonjour ${name},<br/><br/>Merci pour votre message concernant "${subject}". Je reviens vers vous rapidement.<br/><br/>Bien à vous.`;
  }
}

/**
 * Génère UNE proposition de réponse à éditer manuellement — jamais envoyée telle quelle.
 * Utilise le provider IA configuré (AI_PROVIDER + clé) s'il est disponible ; sinon retombe
 * sur un template par règles, clairement identifié comme tel (source: "rules"), jamais
 * présenté comme une génération intelligente.
 */
export async function generateDraftReply(ctx: DraftContext): Promise<DraftResult> {
  const needsInfoByClassification = NEEDS_INFO_CLASSIFICATIONS.includes(ctx.classification);

  if (hasAIProvider()) {
    const aiResult = await callAIProvider(SYSTEM_PROMPT, buildUserPrompt(ctx));
    if (aiResult) {
      const body = aiResult.trim();
      return { body, source: "ai", needsInfo: needsInfoByClassification || body.includes("[à compléter]") };
    }
  }

  return { body: fallbackTemplate(ctx), source: "rules", needsInfo: needsInfoByClassification };
}
