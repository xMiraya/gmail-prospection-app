/**
 * Classification heuristique des emails entrants : distingue une vraie réponse
 * d'un prospect d'une pub/newsletter ou d'une réponse automatique, sans appel
 * IA (rapide, gratuit, et suffisant pour la majorité des cas évidents). Les cas
 * ambigus tombent par défaut sur REAL_REPLY : mieux vaut proposer une réponse
 * de trop que d'ignorer silencieusement un vrai prospect.
 */

export type InboundCategory = "REAL_REPLY" | "AUTO_REPLY" | "AD_NEWSLETTER";

export interface ClassificationInput {
  fromHeader: string;
  subject: string;
  listUnsubscribe?: string;
  precedence?: string;
  autoSubmitted?: string;
  bodyText?: string;
}

const AUTO_REPLY_SUBJECT_PATTERNS = [
  /r[ée]ponse automatique/i,
  /automatic reply/i,
  /out of office/i,
  /absence du bureau/i,
  /je suis (actuellement )?absent/i,
  /accus[ée] de r[ée]ception/i,
  /undeliverable|delivery (status notification|failure)/i,
];

const AD_SENDER_PATTERNS = [
  /no-?reply@/i,
  /ne-?pas-?repondre@/i,
  /notifications?@/i,
  /newsletter@/i,
  /marketing@/i,
  /contact@.*\.(com|fr)$/i,
];

const AD_SUBJECT_PATTERNS = [
  /newsletter/i,
  /d[ée]sabonn/i,
  /unsubscribe/i,
  /promo(tion)?s?\b/i,
  /offre (sp[ée]ciale|exclusive|limit[ée]e)/i,
  /soldes/i,
  /\d{1,3}\s?%\s?de r[ée]duction/i,
  /votre facture/i,
  /confirmation d'abonnement/i,
  /votre abonnement/i,
];

export function classifyInboundEmail(input: ClassificationInput): InboundCategory {
  const from = input.fromHeader ?? "";
  const subject = input.subject ?? "";

  if (input.autoSubmitted && input.autoSubmitted.toLowerCase() !== "no") {
    return "AUTO_REPLY";
  }
  if (AUTO_REPLY_SUBJECT_PATTERNS.some((re) => re.test(subject))) {
    return "AUTO_REPLY";
  }

  // List-Unsubscribe est le signal le plus fiable qu'il s'agit d'un envoi en
  // masse (newsletter, notification de service) et non d'une personne réelle.
  if (input.listUnsubscribe) {
    return "AD_NEWSLETTER";
  }
  if (input.precedence && /bulk|list|junk/i.test(input.precedence)) {
    return "AD_NEWSLETTER";
  }
  if (AD_SENDER_PATTERNS.some((re) => re.test(from))) {
    return "AD_NEWSLETTER";
  }
  if (AD_SUBJECT_PATTERNS.some((re) => re.test(subject))) {
    return "AD_NEWSLETTER";
  }

  return "REAL_REPLY";
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface GmailPart {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: GmailPart[] | null;
}

/** Extrait le texte brut d'un message Gmail (format "full"), en préférant text/plain. */
export function extractPlainTextBody(payload?: GmailPart | null, depth = 0): string {
  if (!payload || depth > 5) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return stripHtml(base64UrlDecode(payload.body.data));
  }

  const parts = payload.parts ?? [];
  const plainPart = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plainPart?.body?.data) return base64UrlDecode(plainPart.body.data);

  const htmlPart = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (htmlPart?.body?.data) return stripHtml(base64UrlDecode(htmlPart.body.data));

  for (const part of parts) {
    const nested = extractPlainTextBody(part, depth + 1);
    if (nested) return nested;
  }

  return "";
}
