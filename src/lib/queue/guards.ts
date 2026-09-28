import type { Prospect, ScheduledEmail } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * Porte de sécurité UNIQUE avant tout envoi réel, quel que soit le chemin
 * (validation manuelle individuelle, validation groupée, ou job cron pour un
 * email déjà VALIDE/PROGRAMME). Doit être appelée juste avant l'appel Gmail.
 *
 * Un email ne peut être envoyé QUE si :
 * - son statut est VALIDE ou PROGRAMME (jamais BROUILLON / A_VALIDER / MODIFIE / REFUSE / ECHEC / ENVOYE) ;
 * - il ne contient plus aucune variable {{...}} non remplacée ;
 * - le prospect n'a pas répondu, n'est pas blacklisté, et n'est pas "Ne plus contacter".
 */
export async function assertSendable(
  email: ScheduledEmail,
  prospect: Prospect
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (email.status !== "VALIDE" && email.status !== "PROGRAMME") {
    return { ok: false, reason: `Statut "${email.status}" non validé : envoi bloqué.` };
  }

  const unresolvedVariables = /\{\{\s*\w+\s*\}\}/.test(email.subject) || /\{\{\s*\w+\s*\}\}/.test(email.bodyHtml);
  if (unresolvedVariables) {
    return { ok: false, reason: "Le message contient encore des variables non remplacées ({{...}})." };
  }

  if (prospect.status === "A_REPONDU") {
    return { ok: false, reason: "Le prospect a répondu : envoi annulé." };
  }
  if (prospect.status === "NE_PLUS_CONTACTER" || prospect.optOutAt) {
    return { ok: false, reason: "Le prospect est sur la liste \"Ne plus contacter\"." };
  }

  const domain = prospect.email.split("@")[1]?.toLowerCase();
  const blacklisted = await prisma.blacklist.findFirst({
    where: {
      userId: prospect.userId,
      OR: [{ email: prospect.email.toLowerCase() }, ...(domain ? [{ domain }] : [])],
    },
  });
  if (blacklisted) {
    return { ok: false, reason: "Cette adresse ou ce domaine est sur liste noire." };
  }

  return { ok: true };
}

export function hasUnresolvedVariables(subject: string, bodyHtml: string) {
  return /\{\{\s*\w+\s*\}\}/.test(subject) || /\{\{\s*\w+\s*\}\}/.test(bodyHtml);
}
