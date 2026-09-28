"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  saveEditedEmail,
  validateAndSendNow,
  validateAndSchedule,
  rejectEmail,
  postponeEmail,
  bulkValidateAndSend,
  getBulkValidationSummaryForCurrentUser,
  type BulkValidationSummary,
} from "@/lib/actions/validation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Globe,
  Linkedin,
  Clock,
  RotateCcw,
  Send,
  Eye,
  PartyPopper,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export type DraftEmail = {
  id: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  scheduledFor: string;
  missingVariables: string[];
  status: string;
  prospect: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    phone: string | null;
    city: string | null;
    sector: string | null;
    website: string | null;
    linkedinUrl: string | null;
    lastContactAt: string | null;
    company: { name: string } | null;
    notes: { id: string; content: string; createdAt: string }[];
    tags: { id: string; name: string; color: string }[];
  };
  campaign: { id: string; name: string; sequenceName: string | null } | null;
  sequenceStep: { order: number } | null;
  history: { id: string; direction: string; subject: string; sentAt: string }[];
};

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function stepLabel(step: { order: number } | null) {
  if (!step) return "Email manuel";
  return step.order === 0 ? "Premier email" : `Relance ${step.order}`;
}

function statusBadge(d: DraftEmail) {
  if (d.missingVariables.length > 0 || /\{\{\s*\w+\s*\}\}/.test(d.subject) || /\{\{\s*\w+\s*\}\}/.test(d.bodyHtml)) {
    return <Badge variant="destructive">À vérifier</Badge>;
  }
  if (d.status === "MODIFIE") return <Badge variant="warning">Modifié</Badge>;
  return <Badge variant="secondary">À valider</Badge>;
}

type FilterKey = "tous" | "premiers" | "relances" | "modifies" | "verifier";

export function ValidationWorkspace({
  drafts,
  sandbox,
  gmailEmail,
}: {
  drafts: DraftEmail[];
  sandbox: { email: string } | null;
  gmailEmail: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("tous");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<BulkValidationSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return drafts.filter((d) => {
      const blocked = d.missingVariables.length > 0;
      if (filter === "premiers" && d.sequenceStep?.order !== 0 && d.sequenceStep !== null) return false;
      if (filter === "premiers" && d.sequenceStep && d.sequenceStep.order !== 0) return false;
      if (filter === "relances" && (!d.sequenceStep || d.sequenceStep.order === 0)) return false;
      if (filter === "modifies" && d.status !== "MODIFIE") return false;
      if (filter === "verifier" && !blocked) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${d.prospect.firstName} ${d.prospect.lastName} ${d.prospect.company?.name ?? ""} ${d.toEmail} ${d.subject}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [drafts, filter, search]);

  const counts = {
    tous: drafts.length,
    premiers: drafts.filter((d) => !d.sequenceStep || d.sequenceStep.order === 0).length,
    relances: drafts.filter((d) => d.sequenceStep && d.sequenceStep.order > 0).length,
    modifies: drafts.filter((d) => d.status === "MODIFIE").length,
    verifier: drafts.filter((d) => d.missingVariables.length > 0).length,
  };

  const focusIndex = focusId ? filtered.findIndex((d) => d.id === focusId) : -1;
  const focusDraft = focusIndex >= 0 ? filtered[focusIndex] : null;

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function openBulk() {
    setBusy(true);
    const summary = await getBulkValidationSummaryForCurrentUser(Array.from(selected));
    setBulkSummary(summary);
    setBulkOpen(true);
    setBusy(false);
  }

  async function confirmBulk() {
    setBusy(true);
    try {
      const results = await bulkValidateAndSend(Array.from(selected));
      const ok = results.filter((r) => r.ok).length;
      toast.success(`${ok} email(s) envoyé(s)`);
      setSelected(new Set());
      setBulkOpen(false);
      setBulkSummary(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la validation groupée");
    }
    setBusy(false);
  }

  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={PartyPopper}
        title="Tout est à jour !"
        description="Aucun email en attente de validation. Les prochains brouillons générés par vos campagnes apparaîtront ici."
        actions={
          <Button asChild variant="outline">
            <Link href="/campagnes">Voir les campagnes</Link>
          </Button>
        }
      />
    );
  }

  if (focusDraft) {
    return (
      <FocusView
        draft={focusDraft}
        index={focusIndex}
        total={filtered.length}
        sandbox={sandbox}
        gmailEmail={gmailEmail}
        onBack={() => setFocusId(null)}
        onNavigate={(dir) => {
          const next = dir === "next" ? focusIndex + 1 : focusIndex - 1;
          if (next >= 0 && next < filtered.length) setFocusId(filtered[next]!.id);
          else {
            setFocusId(null);
            router.refresh();
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">À valider</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {drafts.length} email{drafts.length > 1 ? "s" : ""} préparé{drafts.length > 1 ? "s" : ""}, en attente de votre validation.
            Rien ne part sans votre accord.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList>
            <TabsTrigger value="tous">Tous ({counts.tous})</TabsTrigger>
            <TabsTrigger value="premiers">Premiers emails ({counts.premiers})</TabsTrigger>
            <TabsTrigger value="relances">Relances ({counts.relances})</TabsTrigger>
            <TabsTrigger value="modifies">Modifiés ({counts.modifies})</TabsTrigger>
            <TabsTrigger value="verifier">À vérifier ({counts.verifier})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-secondary/50 px-4 py-2.5">
          <p className="text-sm font-medium">{selected.size} email(s) sélectionné(s)</p>
          <Button size="sm" onClick={openBulk} disabled={busy}>
            <CheckCircle2 className="mr-1.5" /> Valider la sélection
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Prospect</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Campagne</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Date prévue</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => setFocusId(d.id)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleSelect(d.id)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-brand/10 text-brand text-[10px]">
                        {initials(d.prospect.firstName, d.prospect.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{d.prospect.firstName} {d.prospect.lastName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{d.prospect.company?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{d.campaign?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{stepLabel(d.sequenceStep)}</Badge>
                </TableCell>
                <TableCell className="max-w-56 truncate">{d.subject}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {new Date(d.scheduledFor).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </TableCell>
                <TableCell>{statusBadge(d)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setFocusId(d.id); }}>
                    Ouvrir <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  Aucun email ne correspond à ce filtre.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider {bulkSummary?.count ?? selected.size} email(s) ?</DialogTitle>
            <DialogDescription>Vérifiez la liste avant de confirmer un envoi groupé.</DialogDescription>
          </DialogHeader>
          {bulkSummary && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Destinataires :</span> {bulkSummary.recipients.join(", ")}</p>
                <p><span className="text-muted-foreground">Campagnes :</span> {bulkSummary.campaigns.join(", ") || "—"}</p>
                <p><span className="text-muted-foreground">Modifiés manuellement :</span> {bulkSummary.modifiedCount}</p>
              </div>
              {bulkSummary.blockers.length > 0 ? (
                <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 space-y-1">
                  <p className="font-medium flex items-center gap-1.5"><AlertTriangle size={14} /> {bulkSummary.blockers.length} email(s) bloquent l'envoi</p>
                  <ul className="list-disc pl-5">
                    {bulkSummary.blockers.map((b) => <li key={b.id}>{b.toEmail} — {b.reason}</li>)}
                  </ul>
                  <p>Retirez-les de la sélection puis réessayez.</p>
                </div>
              ) : (
                <div className="rounded-md bg-success/10 text-success px-3 py-2">Tous les emails peuvent être envoyés.</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Annuler</Button>
            <Button onClick={confirmBulk} disabled={busy || (bulkSummary?.blockers.length ?? 0) > 0}>
              Confirmer l'envoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FocusView({
  draft,
  index,
  total,
  sandbox,
  gmailEmail,
  onBack,
  onNavigate,
}: {
  draft: DraftEmail;
  index: number;
  total: number;
  sandbox: { email: string } | null;
  gmailEmail: string;
  onBack: () => void;
  onNavigate: (dir: "prev" | "next") => void;
}) {
  const [form, setForm] = useState({ toEmail: draft.toEmail, subject: draft.subject, bodyHtml: draft.bodyHtml });
  const [gmailPreview, setGmailPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ toEmail: draft.toEmail, subject: draft.subject, bodyHtml: draft.bodyHtml });
    setGmailPreview(false);
  }, [draft.id]);

  const dirty = form.toEmail !== draft.toEmail || form.subject !== draft.subject || form.bodyHtml !== draft.bodyHtml;
  const blocked = /\{\{\s*\w+\s*\}\}/.test(form.subject) || /\{\{\s*\w+\s*\}\}/.test(form.bodyHtml);

  const saveIfDirty = useCallback(async () => {
    if (dirty) await saveEditedEmail(draft.id, form);
  }, [dirty, draft.id, form]);

  async function onSend() {
    setBusy(true);
    try {
      await saveIfDirty();
      await validateAndSendNow(draft.id);
      toast.success("Email envoyé", { description: `${draft.prospect.firstName} ${draft.prospect.lastName ?? ""}` });
      onNavigate("next");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    }
    setBusy(false);
  }

  async function onSchedule() {
    setBusy(true);
    try {
      await saveIfDirty();
      await validateAndSchedule(draft.id);
      toast.success("Email programmé");
      onNavigate("next");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function onReject() {
    setBusy(true);
    await rejectEmail(draft.id);
    toast("Email refusé");
    onNavigate("next");
    setBusy(false);
  }

  async function onPostpone() {
    setBusy(true);
    await postponeEmail(draft.id, 24);
    toast("Reporté de 24h");
    onNavigate("next");
    setBusy(false);
  }

  async function onSaveOnly() {
    setBusy(true);
    await saveIfDirty();
    toast.success("Modifications enregistrées");
    setBusy(false);
  }

  const lastContact = draft.prospect.lastContactAt ? new Date(draft.prospect.lastContactAt).toLocaleDateString("fr-FR") : "Jamais";

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5" /> Retour à la liste
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Email {index + 1} / {total}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onNavigate("prev")} disabled={index === 0}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onNavigate("next")}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {blocked && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          <AlertTriangle size={14} className="shrink-0" />
          Ce message contient encore des variables non remplacées ({"{{...}}"}). "Valider et envoyer" est bloqué :
          complétez la fiche prospect, modifiez le texte, ou retirez la variable.
        </div>
      )}
      {sandbox && (
        <div className="flex items-center gap-2 rounded-md bg-warning/15 text-warning-foreground dark:text-warning text-xs px-3 py-2">
          <Sparkles size={13} /> Mode sandbox : cet email partira réellement vers <strong className="mx-1">{sandbox.email || "(non défini)"}</strong> — le prospect ne recevra rien.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4 items-start">
        {/* GAUCHE — PROSPECT */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-brand/10 text-brand text-lg">
                  {initials(draft.prospect.firstName, draft.prospect.lastName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{draft.prospect.firstName} {draft.prospect.lastName}</p>
                {draft.prospect.company && <p className="text-sm text-muted-foreground">{draft.prospect.company.name}</p>}
              </div>
              {draft.prospect.tags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
                  {draft.prospect.tags.map((t) => (
                    <Badge key={t.id} variant="outline" style={{ borderColor: t.color, color: t.color }}>{t.name}</Badge>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail size={13} className="shrink-0" /> <span className="truncate">{draft.prospect.email}</span></div>
              {draft.prospect.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone size={13} className="shrink-0" /> {draft.prospect.phone}</div>}
              {draft.prospect.city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={13} className="shrink-0" /> {draft.prospect.city}</div>}
              {draft.prospect.sector && <div className="flex items-center gap-2 text-muted-foreground"><Briefcase size={13} className="shrink-0" /> {draft.prospect.sector}</div>}
              {draft.prospect.website && <div className="flex items-center gap-2 text-muted-foreground"><Globe size={13} className="shrink-0" /> <span className="truncate">{draft.prospect.website}</span></div>}
              {draft.prospect.linkedinUrl && <div className="flex items-center gap-2 text-muted-foreground"><Linkedin size={13} className="shrink-0" /> LinkedIn</div>}
            </div>
            <Separator />
            <div className="text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Dernier contact</p>
              <p>{lastContact}</p>
            </div>
            {draft.prospect.notes.length > 0 && (
              <div className="text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-muted-foreground line-clamp-3">{draft.prospect.notes[0]?.content}</p>
              </div>
            )}
            {draft.history.length > 0 && (
              <div className="text-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Historique rapide</p>
                <ul className="space-y-1">
                  {draft.history.slice(0, 3).map((h) => (
                    <li key={h.id} className="text-xs text-muted-foreground truncate">
                      {h.direction === "OUTBOUND" ? "→" : "←"} {h.subject}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/prospects/${draft.prospect.id}`}>Voir la fiche complète</Link>
            </Button>
          </CardContent>
        </Card>

        {/* CENTRE — EMAIL */}
        <Card>
          <CardHeader className="pb-3 space-y-3">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm items-center">
              <span className="text-muted-foreground">De</span>
              <span className="font-medium">{gmailEmail}</span>
              <span className="text-muted-foreground">À</span>
              <Input value={form.toEmail} onChange={(e) => setForm((f) => ({ ...f, toEmail: e.target.value }))} className="h-8" />
              <span className="text-muted-foreground">Objet</span>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="h-8 font-medium" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm({ toEmail: draft.toEmail, subject: draft.subject, bodyHtml: draft.bodyHtml })}
                disabled={!dirty}
              >
                <RotateCcw className="mr-1.5" /> Réinitialiser
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setGmailPreview((v) => !v)}>
                <Eye className="mr-1.5" /> {gmailPreview ? "Fermer l'aperçu" : "Aperçu Gmail"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {gmailPreview ? (
              <div className="rounded-md border overflow-hidden">
                <div className="bg-secondary/60 px-4 py-3 text-sm space-y-0.5 border-b">
                  <p><span className="text-muted-foreground">De :</span> {gmailEmail}</p>
                  <p><span className="text-muted-foreground">À :</span> {sandbox ? sandbox.email || "(non défini)" : form.toEmail}</p>
                  <p><span className="text-muted-foreground">Objet :</span> {form.subject}</p>
                </div>
                <div className="prose prose-sm max-w-none p-4 bg-background" dangerouslySetInnerHTML={{ __html: form.bodyHtml }} />
              </div>
            ) : (
              <Textarea
                value={form.bodyHtml}
                onChange={(e) => setForm((f) => ({ ...f, bodyHtml: e.target.value }))}
                rows={14}
                className="font-mono text-sm"
              />
            )}
          </CardContent>
        </Card>

        {/* DROITE — CONTEXTE */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Contexte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Campagne</p>
              <p>{draft.campaign?.name ?? "Email manuel"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Séquence</p>
              <p>{draft.campaign?.sequenceName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Étape actuelle</p>
              <Badge variant="outline">{stepLabel(draft.sequenceStep)}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Date proposée</p>
              <p className="flex items-center gap-1.5"><Clock size={12} /> {new Date(draft.scheduledFor).toLocaleString("fr-FR")}</p>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Historique des contacts</p>
              {draft.history.length === 0 && <p className="text-muted-foreground text-xs">Aucun contact précédent.</p>}
              <ul className="space-y-1.5">
                {draft.history.map((h) => (
                  <li key={h.id} className="text-xs">
                    <span className="text-muted-foreground">{new Date(h.sentAt).toLocaleDateString("fr-FR")}</span> — {h.direction === "OUTBOUND" ? "Envoyé" : "Reçu"} : {h.subject}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre d'action fixe */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 border-t bg-background/95 backdrop-blur px-4 md:px-8 py-3 flex flex-wrap items-center justify-end gap-2 z-20">
        <Button variant="outline" onClick={onReject} disabled={busy}>Refuser</Button>
        <Button variant="outline" onClick={onPostpone} disabled={busy}>Reporter</Button>
        <Button variant="outline" onClick={onSaveOnly} disabled={busy || !dirty}>Enregistrer</Button>
        <Button variant="outline" onClick={onSchedule} disabled={busy || blocked}>Valider et programmer</Button>
        <Button onClick={onSend} disabled={busy || blocked} className="font-semibold">
          <Send className="mr-1.5" /> Valider et envoyer maintenant
        </Button>
      </div>
    </div>
  );
}
