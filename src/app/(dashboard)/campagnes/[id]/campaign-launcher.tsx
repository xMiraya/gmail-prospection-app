"use client";

import { useState } from "react";
import { getCampaignValidationSummary, launchCampaignAction } from "@/lib/actions/campaigns";
import { useRouter } from "next/navigation";

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
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-lg border bg-green-50 border-green-200 p-4 text-sm text-green-900">
        Campagne lancée : {done.prepared} email(s) initial préparé(s) et déposé(s) dans "À valider".
        Aucun envoi n'aura lieu sans votre validation (sauf mode Automatique déjà validé).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="w-8"></th>
              <th>Prospect</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr key={p.id} className="border-t">
                <td>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                <td>{p.firstName} {p.lastName}</td>
                <td>{p.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={onCheckSummary} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
        Vérifier avant lancement ({selected.size} sélectionné(s))
      </button>

      {summary && (
        <div className="rounded-lg border bg-card p-4 space-y-1 text-sm">
          <p className="font-semibold mb-2">Récapitulatif — {summary.campaignName}</p>
          <p>Prospects sélectionnés : {summary.totalProspects}</p>
          <p>Emails valides : {summary.validEmails}</p>
          <p className="text-red-600">Emails invalides : {summary.invalidEmails}</p>
          <p className="text-amber-600">Déjà contactés (exclus) : {summary.alreadyContacted}</p>
          <p className="text-amber-600">Blacklistés (exclus) : {summary.blacklisted}</p>
          <p>Emails programmés aujourd'hui : {summary.scheduledToday}</p>
          <p>Emails programmés plus tard : {summary.scheduledLater}</p>
          <button
            onClick={onLaunch}
            disabled={launching || summary.validEmails === 0}
            className="mt-3 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {launching ? "Lancement..." : "Lancer la campagne"}
          </button>
        </div>
      )}
    </div>
  );
}
