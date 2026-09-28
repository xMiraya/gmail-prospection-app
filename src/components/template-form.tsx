"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { upsertTemplate } from "@/lib/actions/templates";
import { sendTestEmail } from "@/lib/actions/gmail";
import { AVAILABLE_VARIABLES } from "@/lib/templates/render";
import type { EmailTemplate } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";

export function TemplateForm({ template }: { template?: EmailTemplate }) {
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(v: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + `{{${v}}}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}{{${v}}}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + v.length + 4;
      el.setSelectionRange(pos, pos);
    });
  }

  async function onSendTest() {
    if (!template) return;
    setTestStatus("sending");
    try {
      await sendTestEmail(template.id);
      setTestStatus("sent");
      toast.success("Email test envoyé", { description: "Vérifiez votre boîte Gmail." });
    } catch {
      setTestStatus("error");
      toast.error("Échec de l'envoi (Gmail connecté ?)");
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader><CardTitle className="text-base">{template ? "Modifier le template" : "Nouveau template"}</CardTitle></CardHeader>
      <CardContent>
        <form action={upsertTemplate} className="space-y-4">
          {template && <input type="hidden" name="id" value={template.id} />}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nom du template</Label>
              <Input name="name" defaultValue={template?.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Input name="category" defaultValue={template?.category ?? ""} placeholder="Prospection, Relance..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Objet</Label>
            <Input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Contenu (HTML)</Label>
            <Textarea ref={bodyRef} name="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={10} className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Cliquez pour insérer une variable dans le message :</p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARIABLES.map((v) => (
                <button key={v} type="button" onClick={() => insertVariable(v)}>
                  <Badge variant="outline" className="cursor-pointer hover:bg-secondary font-mono">{`{{${v}}}`}</Badge>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center pt-2">
            <Button type="submit">Enregistrer</Button>
            {template && (
              <Button type="button" variant="outline" onClick={onSendTest} disabled={testStatus === "sending"}>
                <Send className="mr-1.5" size={14} /> {testStatus === "sending" ? "Envoi..." : "M'envoyer un email test"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
