"use client";

import { useState } from "react";
import { toast } from "sonner";
import { triggerGmailSync } from "@/lib/actions/gmail";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

export type SyncStatus = {
  connected: boolean;
  lastSyncAt: string | null;
  lastSyncNewCount: number | null;
  lastSyncError: string | null;
};

export function SyncNowButton({ status }: { status: SyncStatus }) {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(status);

  async function onSync() {
    setBusy(true);
    try {
      const res = await triggerGmailSync();
      setLast((s) => ({ ...s, lastSyncAt: "à l'instant", lastSyncNewCount: res.newReplies, lastSyncError: res.errors[0] ?? null }));
      if (res.errors.length > 0) {
        toast.warning(`Synchronisation terminée avec des erreurs`, { description: res.errors[0] });
      } else {
        toast.success(`Synchronisation terminée`, { description: `${res.newReplies} nouveau(x) message(s)` });
      }
    } catch (e) {
      toast.error("Échec de la synchronisation", { description: e instanceof Error ? e.message : undefined });
    }
    setBusy(false);
  }

  if (!last.connected) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle size={13} /> Gmail non connecté
      </div>
    );
  }

  return (
    <div className="text-right space-y-1 shrink-0">
      <Button variant="outline" size="sm" onClick={onSync} disabled={busy}>
        <RefreshCw className={busy ? "mr-1.5 animate-spin" : "mr-1.5"} size={14} />
        {busy ? "Synchronisation..." : "Synchroniser maintenant"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Dernière sync : {last.lastSyncAt ?? "jamais"}
        {last.lastSyncNewCount !== null && ` · ${last.lastSyncNewCount} nouveau(x)`}
      </p>
      {last.lastSyncError && (
        <p className="text-[11px] text-destructive flex items-center gap-1 justify-end">
          <AlertTriangle size={11} /> {last.lastSyncError}
        </p>
      )}
    </div>
  );
}
