"use client";

import { useTransition } from "react";
import { updateProspectStatus } from "@/lib/actions/prospects";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CLASSIFICATIONS = [
  { value: "INTERESSE", label: "Intéressé" },
  { value: "A_RAPPELER", label: "À rappeler" },
  { value: "RENDEZ_VOUS", label: "Rendez-vous" },
  { value: "PAS_INTERESSE", label: "Pas intéressé" },
  { value: "NE_PLUS_CONTACTER", label: "Ne plus contacter" },
];

export function ClassifySelect({ prospectId, current }: { prospectId: string; current: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      defaultValue={current}
      disabled={pending}
      onValueChange={(v) => startTransition(() => updateProspectStatus(prospectId, v))}
    >
      <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
      <SelectContent>
        {CLASSIFICATIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
