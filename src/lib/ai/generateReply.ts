import { prisma } from "@/lib/db/prisma";

/**
 * Rédige une proposition de réponse pour une vraie réponse de prospect détectée,
 * en s'appuyant sur l'historique complet du thread et le contexte du prospect
 * (entreprise, secteur...). Désactivé tant que OPENAI_API_KEY n'est pas configuré :
 * retourne null sans erreur, le reste du flux de synchro continue normalement.
 *
 * La proposition est déposée en ScheduledEmail au statut A_VALIDER : elle passe
 * par la même file de validation humaine que les relances de campagne. Rien n'est
 * jamais envoyé automatiquement par ce module.
 */
export async function maybeDraftAiReply(params: {
  userId: string;
  prospectId: string;
  gmailThreadId: string;
  toEmail: string;
  incomingSubject: string;
  incomingBody: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prospect = await prisma.prospect.findUnique({
    where: { id: params.prospectId },
    include: { company: true },
  });
  if (!prospect) return null;

  const history = await prisma.emailMessage.findMany({
    where: { prospectId: params.prospectId },
    orderBy: { sentAt: "asc" },
    take: 12,
  });

  const historyText = history
    .map((m) => {
      const who = m.direction === "OUTBOUND" ? "Nous" : "Prospect";
      const content = m.bodyHtml ? stripHtml(m.bodyHtml) : m.snippet ?? "";
      return `[${who} — ${m.sentAt.toISOString().slice(0, 10)}] ${m.subject}\n${content}`.trim();
    })
    .join("\n\n");

  const contextLines = [
    `Prénom: ${prospect.firstName}`,
    prospect.lastName ? `Nom: ${prospect.lastName}` : null,
    prospect.company?.name ? `Entreprise: ${prospect.company.name}` : null,
    (prospect.sector ?? prospect.company?.sector) ? `Secteur: ${prospect.sector ?? prospect.company?.sector}` : null,
    prospect.city ? `Ville: ${prospect.city}` : null,
  ].filter(Boolean);

  const prompt = `Tu es un commercial qui répond par email à un prospect, en français, de façon professionnelle, concise (quelques phrases) et directement pertinente par rapport à son dernier message. N'invente aucune information (prix, délai, fonctionnalité) qui n'apparaît pas dans le contexte ou l'historique ci-dessous ; si une précision manque, propose de la clarifier plutôt que de l'inventer.

Contexte du prospect :
${contextLines.join("\n")}

Historique de la conversation :
${historyText || "(aucun échange précédent)"}

Dernier message reçu du prospect :
Objet : ${params.incomingSubject}
${params.incomingBody}

Rédige uniquement le corps HTML (balises <p> simples) de la réponse à envoyer, sans objet, sans salutation finale ni signature (la signature est ajoutée automatiquement par l'application).`;

  let bodyHtml: string | null = null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      console.error("Erreur génération réponse IA", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    bodyHtml = data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("Erreur génération réponse IA", err);
    return null;
  }

  if (!bodyHtml) return null;

  const replySubject = /^re\s*:/i.test(params.incomingSubject)
    ? params.incomingSubject
    : `Re: ${params.incomingSubject}`;

  return prisma.scheduledEmail.create({
    data: {
      userId: params.userId,
      prospectId: params.prospectId,
      status: "A_VALIDER",
      toEmail: params.toEmail,
      subject: replySubject,
      bodyHtml,
      scheduledFor: new Date(),
      threadId: params.gmailThreadId,
    },
  });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
