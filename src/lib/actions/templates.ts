"use server";

import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { detectVariables } from "@/lib/templates/render";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertTemplate(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const body = String(formData.get("body") ?? "");
  const variables = Array.from(new Set([...detectVariables(subject), ...detectVariables(body)]));

  const data = {
    userId,
    name: String(formData.get("name") ?? ""),
    subject,
    body,
    category: String(formData.get("category") ?? "") || null,
    variables,
  };

  if (id) {
    await prisma.emailTemplate.update({ where: { id }, data });
  } else {
    await prisma.emailTemplate.create({ data });
  }
  revalidatePath("/templates");
  redirect("/templates");
}

export async function duplicateTemplate(id: string) {
  const userId = await requireUserId();
  const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { id } });
  await prisma.emailTemplate.create({
    data: {
      userId,
      name: `${original.name} (copie)`,
      subject: original.subject,
      body: original.body,
      category: original.category,
      variables: original.variables,
    },
  });
  revalidatePath("/templates");
}

export async function deleteTemplate(id: string) {
  await prisma.emailTemplate.delete({ where: { id } });
  revalidatePath("/templates");
}
