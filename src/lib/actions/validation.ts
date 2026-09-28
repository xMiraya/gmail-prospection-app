"use server";

import { requireUserId } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import * as core from "@/lib/validation/core";

export type { BulkValidationSummary } from "@/lib/validation/core";

export async function saveEditedEmail(id: string, data: { toEmail: string; subject: string; bodyHtml: string }) {
  const userId = await requireUserId();
  await core.saveEditedEmail(userId, id, data);
  revalidatePath("/a-valider");
}

export async function validateAndSendNow(id: string) {
  const userId = await requireUserId();
  await core.validateAndSendNow(userId, id);
  revalidatePath("/a-valider");
  revalidatePath("/dashboard");
}

/** "Valider et programmer" : l'email partira automatiquement à l'heure prévue, sans re-validation. */
export async function validateAndSchedule(id: string) {
  const userId = await requireUserId();
  await core.validateAndSchedule(userId, id);
  revalidatePath("/a-valider");
}

export async function rejectEmail(id: string, reason?: string) {
  const userId = await requireUserId();
  await core.rejectEmail(userId, id, reason);
  revalidatePath("/a-valider");
}

/** Reporte l'email de N heures (par défaut 24h) sans le modifier ni le refuser. */
export async function postponeEmail(id: string, hours = 24) {
  const userId = await requireUserId();
  await core.postponeEmail(userId, id, hours);
  revalidatePath("/a-valider");
}

/**
 * Résumé obligatoire avant toute validation groupée (cahier des charges §9) :
 * calcule les blocages SANS rien envoyer.
 */
export async function getBulkValidationSummaryForCurrentUser(ids: string[]) {
  const userId = await requireUserId();
  return core.getBulkValidationSummary(userId, ids);
}

/**
 * Validation groupée : n'envoie RIEN si le lot contient le moindre blocage.
 * Voir src/lib/validation/core.ts pour le détail des règles.
 */
export async function bulkValidateAndSend(ids: string[]) {
  const userId = await requireUserId();
  const results = await core.bulkValidateAndSend(userId, ids);
  revalidatePath("/a-valider");
  revalidatePath("/dashboard");
  return results;
}
