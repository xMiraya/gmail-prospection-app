"use client";

import { useTransition } from "react";
import { updateProspectStatus } from "@/lib/actions/prospects";

const CLASSIFICATIONS = ["INTERESSE", "A_RAPPELER", "RENDEZ_VOUS", "PAS_INTERESSE", "NE_PLUS_CONTACTER"];

export function ClassifySelect({ prospectId, current }: { prospectId: string; current: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      defaultValue={current}
      disabled={pending}
      onChange={(e) => startTransition(() => updateProspectStatus(prospectId, e.target.value))}
      className="rounded-md border px-2 py-1 text-xs"
    >
      {CLASSIFICATIONS.map((s) => (
        <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
      ))}
    </select>
  );
}
