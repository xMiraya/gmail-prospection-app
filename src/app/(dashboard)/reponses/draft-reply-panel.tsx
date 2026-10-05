"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptDraftReply, dismissDraftReply } from "@/lib/actions/gmail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, X, AlertTriangle } from "lucide-react";

export function DraftReplyPanel({
  messageId,
  draftReply,
  draftSource,
  draftNeedsInfo,
}: {
  messageId: string;
  draftReply: string;
  draftSource?: string | null;
  draftNeedsInfo?: boolean;
}) {
  const [body, setBody] = useState(draftReply.replace(/<br\s*\/?>/g, "\n"));
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"accepted" | "dismissed" | null>(null);

  function onAccept() {
    startTransition(async () => {
      try {
        await acceptDraftReply(messageId, body.replace(/\n/g, "<br/>"));
        setDone("accepted");
        toast.success("Ajouté à « À valider »", { description: "Aucun envoi n'a été effectué : validez-le manuellement." });
      } catch (e) {
        toast.error("Échec", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function onDismiss() {
    startTransition(async () => {
      await dismissDraftReply(messageId);
      setDone("dismissed");
    });
  }

  if (done) return null;

  return (
    <div className="ml-1 rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Sparkles size={12} /> Proposition de réponse — à relire et modifier avant tout envoi
        </p>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {draftSource === "ai" ? "Générée par IA" : "Modèle par règles (aucune IA connectée)"}
        </Badge>
      </div>
      {draftNeedsInfo && (
        <p className="text-[11px] text-warning-foreground dark:text-warning flex items-center gap-1.5 bg-warning/10 border border-warning/30 rounded px-2 py-1.5">
          <AlertTriangle size={12} /> Information à compléter avant envoi (prix, date ou disponibilité absente du CRM)
        </p>
      )}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="text-sm bg-background" />
      <div className="flex gap-2">
        <Button size="sm" onClick={onAccept} disabled={pending}>
          <Check className="mr-1.5" size={14} /> Accepter et envoyer à « À valider »
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={pending}>
          <X className="mr-1.5" size={14} /> Refuser
        </Button>
      </div>
    </div>
  );
}
