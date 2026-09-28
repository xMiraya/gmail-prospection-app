"use client";

import { useState, useTransition } from "react";
import { updateProspectStatus } from "@/lib/actions/prospects";

const COLUMNS = [
  { key: "NOUVEAU", label: "Nouveau" },
  { key: "CONTACTE", label: "Contacté" },
  { key: "A_REPONDU", label: "A répondu" },
  { key: "INTERESSE", label: "Intéressé" },
  { key: "RENDEZ_VOUS", label: "Rendez-vous" },
  { key: "PROPOSITION_ENVOYEE", label: "Proposition envoyée" },
  { key: "CLIENT", label: "Client" },
  { key: "PAS_INTERESSE", label: "Perdu" },
];

type P = { id: string; firstName: string; lastName: string | null; status: string; company: { name: string } | null };

export function PipelineBoard({ prospects }: { prospects: P[] }) {
  const [items, setItems] = useState(prospects);
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);

  function onDrop(status: string) {
    if (!dragging) return;
    setItems((prev) => prev.map((p) => (p.id === dragging ? { ...p, status } : p)));
    startTransition(() => updateProspectStatus(dragging, status));
    setDragging(null);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colItems = items.filter((p) => p.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
            className="w-64 shrink-0 rounded-lg border bg-muted/40 p-2"
          >
            <p className="text-xs font-semibold px-2 py-1 text-muted-foreground">
              {col.label} ({colItems.length})
            </p>
            <div className="space-y-2 min-h-[100px]">
              {colItems.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragging(p.id)}
                  className="rounded-md border bg-card p-2 text-sm cursor-grab shadow-sm"
                >
                  <p className="font-medium">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-muted-foreground">{p.company?.name ?? "—"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
