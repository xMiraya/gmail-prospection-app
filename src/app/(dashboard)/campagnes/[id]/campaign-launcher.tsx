"use client";

import { useState } from "react";
import { getCampaignValidationSummary, launchCampaignAction } from "@/lib/actions/campaigns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Prospect = { id: string; firstName: string; lastName: string | null; email: string };

export function CampaignLauncher({ campaignId, prospects }: { campaignId: string; prospects: Prospect[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(prospects.map((p) => p.id)));
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getCampaignValidationSummary>> | null>(null);
  const [launching, setLaunching] = useState(false);
  const [done, setDone] = useState<Awaited<ReturnType<typeof launchCampaignAction>> | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onCheckSummary() {
    const res = await getCampaignValidationSummary(campaignId, Array.from(selected));
    setSummary(res);
  }

  async function onLaunch() {
    setLaunching(true);
    const res = await launchCampaignAction(campaignId, Array.from(selected));
    setDone(res);
    setLaunching(false);
    toast.success(`${res.prepared} email(s) déposé(s) dans "À valider"`);
    router.refresh();
  }

  if (done) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="pt-6 text-sm">
          Campagne lancée : {done.prepared} email(s) initial préparé(s) et déposé(s) dans "À valider".
          Aucun envoi n'aura lieu sans votre validation.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="max-h-72 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Prospect</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prospects.map((p) => (
              <TableRow key={p.id}>
                <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                <TableCell>{p.firstName} {p.lastName}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Button variant="outline" onClick={onCheckSummary}>
        Vérifier avant lancement ({selected.size} sélectionné(s))
      </Button>

      {summary && (
        <Card>
          <CardContent className="pt-6 space-y-1 text-sm">
            <p className="font-semibold mb-2">Récapitulatif — {summary.campaignName}</p>
            <p>Prospects sélectionnés : {summary.totalProspects}</p>
            <p>Emails valides : {summary.validEmails}</p>
            <p className="text-destructive">Emails invalides : {summary.invalidEmails}</p>
            <p className="text-warning-foreground dark:text-warning">Déjà contactés (exclus) : {summary.alreadyContacted}</p>
            <p className="text-warning-foreground dark:text-warning">Blacklistés (exclus) : {summary.blacklisted}</p>
            <p>Emails programmés aujourd'hui : {summary.scheduledToday}</p>
            <p>Emails programmés plus tard : {summary.scheduledLater}</p>
            <Button onClick={onLaunch} disabled={launching || summary.validEmails === 0} className="mt-3">
              {launching ? "Lancement..." : "Lancer la campagne"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
