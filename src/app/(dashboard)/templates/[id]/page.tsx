import { prisma } from "@/lib/db/prisma";
import { TemplateForm } from "@/components/template-form";
import { notFound } from "next/navigation";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!template) notFound();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Modifier le template</h1>
      <TemplateForm template={template} />
    </div>
  );
}
