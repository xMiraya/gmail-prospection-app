import { TemplateForm } from "@/components/template-form";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nouveau template</h1>
      <TemplateForm />
    </div>
  );
}
