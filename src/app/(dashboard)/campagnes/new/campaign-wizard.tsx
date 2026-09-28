"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getNewCampaignSummary, createCampaignAndPrepare, type NewCampaignInput } from "@/lib/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList,
  Users,
  Workflow,
  CalendarClock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Sequence = { id: string; name: string; steps: { order: number; delayDays: number; template: { name: string } }[] };
type Prospect = { id: string; firstName: string; lastName: string | null; email: string; city: string | null; sector: string | null; status: string };

const STEPS = [
  { key: "info", label: "Informations", icon: ClipboardList },
  { key: "prospects", label: "Prospects", icon: Users },
  { key: "sequence", label: "Séquence", icon: Workflow },
  { key: "planning", label: "Planification", icon: CalendarClock },
  { key: "review", label: "Validation", icon: ShieldCheck },
] as const;

const DAYS = [
  { value: 1, label: "Lun" }, { value: 2, label: "Mar" }, { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" }, { value: 5, label: "Ven" }, { value: 6, label: "Sam" }, { value: 0, label: "Dim" },
];

export function CampaignWizard({ sequences, prospects }: { sequences: Sequence[]; prospects: Prospect[] }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sequenceId, setSequenceId] = useState(sequences[0]?.id ?? "");
  const [dailyLimit, setDailyLimit] = useState(25);
  const [sendStartHour, setSendStartHour] = useState(9);
  const [sendEndHour, setSendEndHour] = useState(17);
  const [sendDays, setSendDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [automationMode, setAutomationMode] = useState<NewCampaignInput["automationMode"]>("MANUEL");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getNewCampaignSummary>> | null>(null);

  const filteredProspects = useMemo(() => {
    if (!search) return prospects;
    const q = search.toLowerCase();
    return prospects.filter((p) => `${p.firstName} ${p.lastName} ${p.email} ${p.city ?? ""} ${p.sector ?? ""}`.toLowerCase().includes(q));
  }, [prospects, search]);

  const selectedSequence = sequences.find((s) => s.id === sequenceId);

  const canNext = [
    name.trim().length > 0,
    selected.size > 0,
    !!sequenceId,
    sendDays.size > 0 && sendStartHour < sendEndHour,
    true,
  ];

  function toggleProspect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleDay(d: number) {
    setSendDays((s) => {
      const next = new Set(s);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

  async function goNext() {
    if (stepIndex === 3) {
      setBusy(true);
      const s = await getNewCampaignSummary(Array.from(selected), dailyLimit);
      setSummary(s);
      setBusy(false);
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  async function onCreate() {
    setBusy(true);
    try {
      const result = await createCampaignAndPrepare(
        {
          name,
          description,
          sequenceId,
          dailyLimit,
          sendStartHour,
          sendEndHour,
          sendDays: Array.from(sendDays),
          automationMode,
        },
        Array.from(selected)
      );
      toast.success(`Campagne créée — ${result.prepared} email(s) déposé(s) dans "À valider"`, {
        description: "Aucun email n'a été envoyé automatiquement.",
      });
      router.push(`/campagnes/${result.campaignId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la création de la campagne");
    }
    setBusy(false);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nouvelle campagne</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Les emails seront préparés mais pas envoyés — vous les validerez ensuite dans "À valider".
        </p>
      </div>

      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <div key={s.key} className="flex items-center flex-1">
              <div className={cn("flex items-center gap-2 text-xs font-medium", active ? "text-foreground" : done ? "text-brand" : "text-muted-foreground")}>
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center border",
                  active && "border-brand bg-brand text-brand-foreground",
                  done && "border-brand bg-brand/10 text-brand",
                  !active && !done && "border-border"
                )}>
                  {done ? <Check size={13} /> : <Icon size={13} />}
                </div>
                <span className="hidden md:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1 mx-2", done ? "bg-brand" : "bg-border")} />}
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="pt-6">
          {stepIndex === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nom de la campagne</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prospection sites internet — Bretagne" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {stepIndex === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{selected.size} prospect(s) sélectionné(s)</p>
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8" />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
                {filteredProspects.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-secondary/40">
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleProspect(p.id)} />
                    <span className="flex-1">{p.firstName} {p.lastName} <span className="text-muted-foreground">— {p.email}</span></span>
                    <Badge variant="outline">{p.status}</Badge>
                  </label>
                ))}
                {filteredProspects.length === 0 && <p className="text-sm text-muted-foreground p-4">Aucun prospect ne correspond.</p>}
              </div>
            </div>
          )}

          {stepIndex === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Séquence</Label>
                <Select value={sequenceId} onValueChange={setSequenceId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sequences.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedSequence && (
                <div className="space-y-2">
                  {selectedSequence.steps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm rounded-md border px-3 py-2">
                      <Badge variant="brand">{i === 0 ? "Email initial" : `Relance ${i}`}</Badge>
                      <span className="text-muted-foreground">{i === 0 ? "Envoi au lancement" : `+${step.delayDays} j`}</span>
                      <span className="flex-1 truncate">{step.template.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pour modifier les étapes ou templates de cette séquence, rendez-vous dans "Séquences".
              </p>
            </div>
          )}

          {stepIndex === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Emails / jour</Label>
                  <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} min={1} max={200} />
                </div>
                <div className="space-y-1.5">
                  <Label>Heure début</Label>
                  <Input type="number" value={sendStartHour} onChange={(e) => setSendStartHour(Number(e.target.value))} min={0} max={23} />
                </div>
                <div className="space-y-1.5">
                  <Label>Heure fin</Label>
                  <Input type="number" value={sendEndHour} onChange={(e) => setSendEndHour(Number(e.target.value))} min={0} max={23} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Jours d'envoi</Label>
                <div className="flex gap-1.5">
                  {DAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={cn(
                        "h-9 w-11 rounded-md border text-xs font-medium transition-colors",
                        sendDays.has(d.value) ? "bg-brand text-brand-foreground border-brand" : "hover:bg-secondary"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Mode d'automatisation</Label>
                <Select value={automationMode} onValueChange={(v) => setAutomationMode(v as NewCampaignInput["automationMode"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUEL">Manuel — je valide chaque email et chaque relance</SelectItem>
                    <SelectItem value="SEMI_AUTOMATIQUE">Semi-automatique — relances préparées auto, à valider</SelectItem>
                    <SelectItem value="AUTOMATIQUE">Automatique — envoi selon règles, après validation globale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {stepIndex === 4 && (
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">Récapitulatif</CardTitle>
                <CardDescription>Vérifiez avant de créer la campagne. Aucun email ne sera envoyé automatiquement.</CardDescription>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3"><p className="text-muted-foreground text-xs">Campagne</p><p className="font-medium">{name}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground text-xs">Séquence</p><p className="font-medium">{selectedSequence?.name}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground text-xs">Prospects sélectionnés</p><p className="font-medium">{selected.size}</p></div>
                <div className="rounded-md border p-3"><p className="text-muted-foreground text-xs">Limite quotidienne</p><p className="font-medium">{dailyLimit} / jour</p></div>
              </div>
              {summary && (
                <div className="rounded-md border p-4 space-y-1 text-sm">
                  <p>Emails valides : <strong>{summary.validEmails}</strong></p>
                  <p className="text-destructive">Emails invalides : {summary.invalidEmails}</p>
                  <p className="text-warning-foreground dark:text-warning">Déjà contactés (exclus) : {summary.alreadyContacted}</p>
                  <p className="text-warning-foreground dark:text-warning">Blacklistés (exclus) : {summary.blacklisted}</p>
                  <p>Emails programmés aujourd'hui : <strong>{summary.scheduledToday}</strong></p>
                  <p>Emails programmés plus tard : <strong>{summary.scheduledLater}</strong></p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
          <ChevronLeft className="mr-1" /> Précédent
        </Button>
        {stepIndex < STEPS.length - 1 ? (
          <Button onClick={goNext} disabled={!canNext[stepIndex] || busy}>
            Suivant <ChevronRight className="ml-1" />
          </Button>
        ) : (
          <Button onClick={onCreate} disabled={busy}>
            {busy ? "Création..." : "Créer la campagne"}
          </Button>
        )}
      </div>
    </div>
  );
}
