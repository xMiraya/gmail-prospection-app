"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Papa from "papaparse";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateProspectStatus(prospectId: string, status: string) {
  const userId = await requireUserId();
  await prisma.prospect.update({
    where: { id: prospectId, userId },
    data: { status: status as never },
  });
  await logActivity(userId, "STATUS_CHANGED", prospectId, { status });
  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath("/prospects");
  revalidatePath("/pipeline");
}

export async function addProspectNote(prospectId: string, content: string) {
  const userId = await requireUserId();
  await prisma.prospectNote.create({ data: { prospectId, content } });
  revalidatePath(`/prospects/${prospectId}`);
}

export async function optOutProspect(prospectId: string) {
  const userId = await requireUserId();
  await prisma.prospect.update({
    where: { id: prospectId, userId },
    data: { status: "NE_PLUS_CONTACTER", optOutAt: new Date() },
  });
  await prisma.blacklist.create({
    data: {
      userId,
      email: (await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } })).email,
      reason: "Opposition / désinscription manuelle",
    },
  });
  revalidatePath(`/prospects/${prospectId}`);
}

export async function createProspect(formData: FormData) {
  const userId = await requireUserId();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Email invalide");

  const prospect = await prisma.prospect.create({
    data: {
      userId,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? "") || null,
      email,
      phone: String(formData.get("phone") ?? "") || null,
      website: String(formData.get("website") ?? "") || null,
      sector: String(formData.get("sector") ?? "") || null,
      city: String(formData.get("city") ?? "") || null,
      country: String(formData.get("country") ?? "") || null,
      source: String(formData.get("source") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    },
  });
  await logActivity(userId, "PROSPECT_CREATED", prospect.id);
  revalidatePath("/prospects");
  redirect(`/prospects/${prospect.id}`);
}

export type CsvPreviewRow = Record<string, string>;

/** Analyse un CSV et retourne les lignes + les doublons/emails invalides détectés. */
export async function analyzeCsv(csvText: string) {
  const userId = await requireUserId();
  const parsed = Papa.parse<CsvPreviewRow>(csvText, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  const existingEmails = new Set(
    (await prisma.prospect.findMany({ where: { userId }, select: { email: true } })).map((p) =>
      p.email.toLowerCase()
    )
  );

  const seen = new Set<string>();
  const analyzed = rows.map((row) => {
    const email = (row.email ?? row.Email ?? "").trim().toLowerCase();
    const invalid = !EMAIL_RE.test(email);
    const duplicateInFile = seen.has(email);
    const duplicateExisting = existingEmails.has(email);
    seen.add(email);
    return { row, email, invalid, duplicateInFile, duplicateExisting };
  });

  return {
    columns: parsed.meta.fields ?? [],
    rows: analyzed,
    total: analyzed.length,
    invalidCount: analyzed.filter((r) => r.invalid).length,
    duplicateCount: analyzed.filter((r) => r.duplicateInFile || r.duplicateExisting).length,
  };
}

/** Importe les lignes valides et non-dupliquées d'un CSV, avec mapping de colonnes explicite. */
export async function importCsv(
  csvText: string,
  mapping: Record<string, string> // clé = champ prospect, valeur = nom de colonne CSV
) {
  const userId = await requireUserId();
  const parsed = Papa.parse<CsvPreviewRow>(csvText, { header: true, skipEmptyLines: true });

  let imported = 0;
  let skipped = 0;

  for (const row of parsed.data) {
    const email = (row[mapping.email] ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      skipped++;
      continue;
    }
    const exists = await prisma.prospect.findUnique({ where: { userId_email: { userId, email } } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.prospect.create({
      data: {
        userId,
        email,
        firstName: row[mapping.firstName] ?? "",
        lastName: mapping.lastName ? row[mapping.lastName] ?? null : null,
        phone: mapping.phone ? row[mapping.phone] ?? null : null,
        website: mapping.website ? row[mapping.website] ?? null : null,
        sector: mapping.sector ? row[mapping.sector] ?? null : null,
        city: mapping.city ? row[mapping.city] ?? null : null,
        country: mapping.country ? row[mapping.country] ?? null : null,
        source: mapping.source ? row[mapping.source] ?? "Import CSV" : "Import CSV",
      },
    });
    imported++;
  }

  revalidatePath("/prospects");
  return { imported, skipped };
}
