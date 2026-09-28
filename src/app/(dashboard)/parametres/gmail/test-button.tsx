"use client";

import { useState } from "react";
import { toast } from "sonner";
import { testGmailConnection } from "@/lib/actions/gmail";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function TestGmailButton() {
  const [busy, setBusy] = useState(false);

  async function onTest() {
    setBusy(true);
    try {
      const res = await testGmailConnection();
      toast.success("Connexion Gmail OK", { description: `${res.email} — ${res.messagesTotal} messages dans la boîte` });
    } catch (e) {
      toast.error("Échec du test de connexion", { description: e instanceof Error ? e.message : undefined });
    }
    setBusy(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={onTest} disabled={busy}>
      <RefreshCw className="mr-1.5" size={14} /> {busy ? "Test en cours..." : "Tester"}
    </Button>
  );
}
