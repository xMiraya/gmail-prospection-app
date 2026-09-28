"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeCsv, importCsv, type CsvPreviewRow } from "@/lib/actions/prospects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadCloud, CheckCircle2 } from "lucide-react";

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
      <h1 className="text-2xl font-semibold tracking-tight">Importer des prospects</h1>

      {!preview && (
        <Card>
          <CardContent className="pt-6">
            <label className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-14 cursor-pointer hover:bg-secondary/30 transition-colors">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">Cliquez pour choisir un fichier .csv</span>
              <span className="text-xs text-muted-foreground">Avec une ligne d'en-têtes</span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </CardContent>
        </Card>
      )}

      {preview && !result && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Lignes détectées</p><p className="text-2xl font-semibold">{preview.total}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Emails invalides</p><p className="text-2xl font-semibold text-destructive">{preview.invalidCount}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Doublons détectés</p><p className="text-2xl font-semibold text-warning-foreground dark:text-warning">{preview.duplicateCount}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Mapper les colonnes</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="text-xs font-medium">{f.label}</label>
                  <Select value={mapping[f.key] ?? "__none__"} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Ne pas importer —</SelectItem>
                      {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Aperçu (5 premières lignes)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 5).map((r: { row: CsvPreviewRow; invalid: boolean; duplicateInFile: boolean; duplicateExisting: boolean }, i: number) => (
                    <TableRow key={i}>
                      {columns.map((c) => <TableCell key={c}>{r.row[c]}</TableCell>)}
                      <TableCell>
                        {r.invalid ? <Badge variant="destructive">Email invalide</Badge>
                          : r.duplicateExisting ? <Badge variant="warning">Déjà existant</Badge>
                          : r.duplicateInFile ? <Badge variant="warning">Doublon</Badge>
                          : <Badge variant="success">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Button onClick={onImport} disabled={loading || !mapping.email || !mapping.firstName} size="lg">
            {loading ? "Import en cours..." : "Importer les prospects valides"}
          </Button>
        </div>
      )}

      {result && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 />
              <p className="text-sm">
                <strong>{result.imported}</strong> prospects importés, <strong>{result.skipped}</strong> ignorés (emails invalides ou déjà existants).
              </p>
            </div>
            <Button onClick={() => router.push("/prospects")}>Voir les prospects</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
