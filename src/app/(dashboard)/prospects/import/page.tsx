"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeCsv, importCsv, type CsvPreviewRow } from "@/lib/actions/prospects";

const FIELDS = [
  { key: "email", label: "Email *", required: true },
  { key: "firstName", label: "Prénom *", required: true },
  { key: "lastName", label: "Nom" },
  { key: "phone", label: "Téléphone" },
  { key: "website", label: "Site internet" },
  { key: "sector", label: "Secteur" },
  { key: "city", label: "Ville" },
  { key: "country", label: "Pays" },
  { key: "source", label: "Source" },
];

export default function ImportCsvPage() {
  const router = useRouter();
  const [csvText, setCsvText] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof analyzeCsv>> | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    const analyzed = await analyzeCsv(text);
    setColumns(analyzed.columns);
    setPreview(analyzed);
    const auto: Record<string, string> = {};
    for (const f of FIELDS) {
      const match = analyzed.columns.find((c) => c.toLowerCase().includes(f.key.toLowerCase()));
      if (match) auto[f.key] = match;
    }
    setMapping(auto);
  }

  async function onImport() {
    if (!csvText) return;
    setLoading(true);
    const res = await importCsv(csvText, mapping);
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Importer des prospects (CSV)</h1>

      {!preview && (
        <div className="rounded-lg border-2 border-dashed p-10 text-center">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground mt-2">Fichier .csv avec une ligne d'en-têtes</p>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Lignes détectées</p>
              <p className="text-2xl font-semibold">{preview.total}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Emails invalides</p>
              <p className="text-2xl font-semibold text-red-600">{preview.invalidCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Doublons détectés</p>
              <p className="text-2xl font-semibold text-amber-600">{preview.duplicateCount}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h2 className="font-semibold text-sm">Mapper les colonnes</h2>
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium">{f.label}</label>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  >
                    <option value="">— Ne pas importer —</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <p className="px-4 py-2 text-sm font-semibold border-b">Aperçu (5 premières lignes)</p>
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {columns.map((c) => <th key={c} className="text-left px-3 py-1.5">{c}</th>)}
                  <th className="text-left px-3 py-1.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((r: { row: CsvPreviewRow; invalid: boolean; duplicateInFile: boolean; duplicateExisting: boolean }, i: number) => (
                  <tr key={i} className="border-t">
                    {columns.map((c) => <td key={c} className="px-3 py-1.5">{r.row[c]}</td>)}
                    <td className="px-3 py-1.5">
                      {r.invalid ? <span className="text-red-600">Email invalide</span>
                        : r.duplicateExisting ? <span className="text-amber-600">Déjà existant</span>
                        : r.duplicateInFile ? <span className="text-amber-600">Doublon dans le fichier</span>
                        : <span className="text-green-600">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={onImport}
            disabled={loading || !mapping.email || !mapping.firstName}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Import en cours..." : `Importer les prospects valides`}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <p className="text-sm">
            <strong>{result.imported}</strong> prospects importés, <strong>{result.skipped}</strong> ignorés
            (emails invalides ou déjà existants).
          </p>
          <button
            onClick={() => router.push("/prospects")}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
          >
            Voir les prospects
          </button>
        </div>
      )}
    </div>
  );
}
