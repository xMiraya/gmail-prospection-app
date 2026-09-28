"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateProspectStatus } from "@/lib/actions/prospects";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "NOUVEAU", label: "Nouveau" },
  { key: "CONTACTE", label: "Contacté" },
  { key: "A_REPONDU", label: "A répondu" },
  { key: "INTERESSE", label: "Intéressé" },
  { key: "RENDEZ_VOUS", label: "Rendez-vous" },
  { key: "PROPOSITION_ENVOYEE", label: "Proposition" },
  { key: "CLIENT", label: "Client" },
  { key: "PAS_INTERESSE", label: "Perdu" },
];

type P = { id: string; firstName: string; lastName: string | null; status: string; company: { name: string } | null };

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export function PipelineBoard({ prospects }: { prospects: P[] }) {
  const [items, setItems] = useState(prospects);
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  function onDrop(status: string) {
    if (!dragging) return;
    setItems((prev) => prev.map((p) => (p.id === dragging ? { ...p, status } : p)));
    startTransition(() => updateProspectStatus(dragging, status));
    setDragging(null);
    setOverCol(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colItems = items.filter((p) => p.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => onDrop(col.key)}
            className={cn(
              "w-64 shrink-0 rounded-lg border bg-secondary/30 p-2 transition-colors",
              overCol === col.key && "bg-brand/10 border-brand/40"
            )}
          >
            <p className="text-xs font-semibold px-2 py-1.5 text-muted-foreground flex items-center justify-between">
              {col.label}
              <span className="bg-secondary rounded-full px-1.5 text-[10px]">{colItems.length}</span>
            </p>
            <div className="space-y-2 min-h-[80px]">
              {colItems.map((p) => (
                <Link
                  key={p.id}
                  href={`/prospects/${p.id}`}
                  draggable
                  onDragStart={() => setDragging(p.id)}
                  className="flex items-center gap-2 rounded-md border bg-card p-2.5 text-sm cursor-grab shadow-sm hover:shadow-md transition-shadow"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-brand/10 text-brand text-[9px]">{initials(p.firstName, p.lastName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.company?.name ?? "—"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
