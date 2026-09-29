"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptDraftReply, dismissDraftReply } from "@/lib/actions/gmail";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X } from "lucide-react";

export function DraftReplyPanel({ messageId, draftReply }: { messageId: string; draftReply: string }) {
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
      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Sparkles size={12} /> Proposition de réponse — à relire et modifier avant tout envoi
      </p>
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
