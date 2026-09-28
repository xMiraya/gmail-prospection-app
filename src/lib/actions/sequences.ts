"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createSequence(formData: FormData) {
  const userId = await requireUserId();
  const sequence = await prisma.sequence.create({
    data: {
      userId,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
    },
  });
  redirect(`/sequences/${sequence.id}`);
}

export async function addSequenceStep(sequenceId: string, formData: FormData) {
  await requireUserId();
  const existingCount = await prisma.sequenceStep.count({ where: { sequenceId } });
  await prisma.sequenceStep.create({
    data: {
      sequenceId,
      order: existingCount,
      delayDays: Number(formData.get("delayDays") ?? 0),
      templateId: String(formData.get("templateId")),
      approxHour: Number(formData.get("approxHour") ?? 9),
    },
  });
  revalidatePath(`/sequences/${sequenceId}`);
}

export async function removeSequenceStep(sequenceId: string, stepId: string) {
  await requireUserId();
  await prisma.sequenceStep.delete({ where: { id: stepId } });
  // Renumérote les étapes restantes pour rester contigu (0,1,2...)
  const remaining = await prisma.sequenceStep.findMany({ where: { sequenceId }, orderBy: { order: "asc" } });
  await Promise.all(
    remaining.map((s, i) => prisma.sequenceStep.update({ where: { id: s.id }, data: { order: i } }))
  );
  revalidatePath(`/sequences/${sequenceId}`);
}
