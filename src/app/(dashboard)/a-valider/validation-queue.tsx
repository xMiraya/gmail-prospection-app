"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveEditedEmail,
  validateAndSendNow,
  validateAndSchedule,
  rejectEmail,
  postponeEmail,
  bulkValidateAndSend,
} from "@/lib/actions/validation";

export type DraftEmail = {
  id: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  scheduledFor: string;
  missingVariables: string[];
  status: string;
  prospect: { firstName: string; lastName: string | null; company: { name: string } | null };
  campaign: { name: string } | null;
  sequenceStep: { order: number } | null;
};

export function ValidationQueue({ drafts }: { drafts: DraftEmail[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ toEmail: "", subject: "", bodyHtml: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = drafts[index];

  useEffect(() => {
    if (current) setForm({ toEmail: current.toEmail, subject: current.subject, bodyHtml: current.bodyHtml });
    setEditing(false);
  }, [current?.id]);

  function next() {
    if (index < drafts.length - 1) setIndex(index + 1);
    else router.refresh();
  }

  async function onValidateSend() {
    if (!current) return;
    setBusy(true);
    try {
      if (editing) await saveEditedEmail(current.id, form);
      await validateAndSendNow(current.id);
      next();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function onValidateSchedule() {
    if (!current) return;
    setBusy(true);
    if (editing) await saveEditedEmail(current.id, form);
    await validateAndSchedule(current.id);
    setBusy(false);
    next();
  }

  async function onReject() {
    if (!current) return;
    setBusy(true);
    await rejectEmail(current.id);
    setBusy(false);
    next();
  }

  async function onPostpone() {
    if (!current) return;
    setBusy(true);
    await postponeEmail(current.id, 24);
    setBusy(false);
    next();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onBulkConfirm() {
    setBusy(true);
    await bulkValidateAndSend(Array.from(selected));
    setBusy(false);
    setConfirmBulk(false);
    setSelected(new Set());
    router.refresh();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editing || busy) return;
      if (e.key === "Enter") onValidateSend();
      else if (e.key.toLowerCase() === "e") setEditing(true);
      else if (e.key.toLowerCase() === "r") onReject();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (drafts.length === 0 || !current) {
    return <p className="text-sm text-muted-foreground">Aucun email en attente de validation. 🎉</p>;
  }

  return (
    <div className="space-y-6">
      {selected.size > 0 && (
        <div className="rounded-lg border bg-amber-50 border-amber-200 p-4 flex items-center justify-between">
          <p className="text-sm">{selected.size} email(s) sélectionné(s) pour validation groupée</p>
          <button
            onClick={() => setConfirmBulk(true)}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"
          >
            Valider les {selected.size} emails
          </button>
        </div>
      )}

      {confirmBulk && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">
            Vous êtes sur le point de valider et envoyer {selected.size} email(s) :
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5">
            {drafts.filter((d) => selected.has(d.id)).map((d) => (
              <li key={d.id}>{d.toEmail} ({d.prospect.firstName})</li>
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <button onClick={onBulkConfirm} disabled={busy} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm">
              Confirmer l'envoi
            </button>
            <button onClick={() => setConfirmBulk(false)} className="rounded-md border px-4 py-2 text-sm">Annuler</button>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Email {index + 1} / {drafts.length} — Raccourcis : Entrée = valider, E = modifier, R = refuser, → = suivant
      </p>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">
              {current.prospect.firstName} {current.prospect.lastName} — {current.prospect.company?.name ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              À : {current.toEmail} · Campagne : {current.campaign?.name ?? "—"} ·{" "}
              Étape : {current.sequenceStep ? (current.sequenceStep.order === 0 ? "Premier contact" : `Relance ${current.sequenceStep.order}`) : "Email manuel"} ·{" "}
              Prévu le {new Date(current.scheduledFor).toLocaleString("fr-FR")}
            </p>
          </div>
          <input
            type="checkbox"
            checked={selected.has(current.id)}
            onChange={() => toggleSelect(current.id)}
            title="Sélectionner pour validation groupée"
          />
        </div>

        {current.missingVariables.length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
            Variables manquantes : {current.missingVariables.join(", ")}. Corrigez avant d'envoyer.
          </div>
        )}

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Destinataire</label>
              <input value={form.toEmail} onChange={(e) => setForm({ ...form, toEmail: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Objet</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium">Message</label>
              <textarea value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} rows={10} className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-medium">Objet : {current.subject}</p>
            <div className="prose prose-sm max-w-none border rounded-md p-4 bg-muted/30" dangerouslySetInnerHTML={{ __html: current.bodyHtml }} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onReject} disabled={busy} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Refuser
          </button>
          <button onClick={() => setEditing((e) => !e)} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            {editing ? "Aperçu" : "Modifier"}
          </button>
          <button onClick={onPostpone} disabled={busy} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Reporter (+24h)
          </button>
          <button onClick={onValidateSchedule} disabled={busy} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Valider et programmer
          </button>
          <button onClick={onValidateSend} disabled={busy} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            Valider et envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
