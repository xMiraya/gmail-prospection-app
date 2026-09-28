"use client";

import { useState } from "react";
import { upsertTemplate } from "@/lib/actions/templates";
import { sendTestEmail } from "@/lib/actions/gmail";
import { AVAILABLE_VARIABLES } from "@/lib/templates/render";
import type { EmailTemplate } from "@prisma/client";

export function TemplateForm({ template }: { template?: EmailTemplate }) {
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSendTest() {
    if (!template) return;
    setTestStatus("sending");
    try {
      await sendTestEmail(template.id);
      setTestStatus("sent");
    } catch {
      setTestStatus("error");
    }
  }

  return (
    <form action={upsertTemplate} className="space-y-4 rounded-lg border bg-card p-6 max-w-2xl">
      {template && <input type="hidden" name="id" value={template.id} />}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Nom du template</label>
          <input name="name" defaultValue={template?.name} required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Catégorie</label>
          <input name="category" defaultValue={template?.category ?? ""} placeholder="Prospection, Relance..." className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Objet</label>
        <input name="subject" defaultValue={template?.subject} required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Contenu (HTML)</label>
        <textarea name="body" defaultValue={template?.body} required rows={10} className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono" />
      </div>
      <div className="text-xs text-muted-foreground">
        Variables disponibles : {AVAILABLE_VARIABLES.map((v) => `{{${v}}}`).join(", ")}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Enregistrer
        </button>
        {template && (
          <button
            type="button"
            onClick={onSendTest}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            {testStatus === "sending" ? "Envoi..." : "M'envoyer un email test"}
          </button>
        )}
        {testStatus === "sent" && <span className="text-sm text-green-600 self-center">Email test envoyé !</span>}
        {testStatus === "error" && <span className="text-sm text-red-600 self-center">Échec de l'envoi (Gmail connecté ?)</span>}
      </div>
    </form>
  );
}
