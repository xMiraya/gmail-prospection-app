import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { createSequence } from "@/lib/actions/sequences";
import Link from "next/link";

export default async function SequencesPage() {
  const userId = await requireUserId();
  const sequences = await prisma.sequence.findMany({
    where: { userId },
    include: { steps: true, campaigns: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Séquences</h1>

      <form action={createSequence} className="rounded-lg border bg-card p-4 flex gap-2">
        <input name="name" placeholder="Nom de la séquence" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <input name="description" placeholder="Description (optionnel)" className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <button className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium" type="submit">
          Créer
        </button>
      </form>

      <div className="space-y-3">
        {sequences.map((s) => (
          <Link key={s.id} href={`/sequences/${s.id}`} className="block rounded-lg border bg-card p-4 hover:border-primary/40">
            <p className="font-semibold">{s.name}</p>
            <p className="text-sm text-muted-foreground">
              {s.steps.length} étape(s) · utilisée par {s.campaigns.length} campagne(s)
            </p>
          </Link>
        ))}
        {sequences.length === 0 && <p className="text-sm text-muted-foreground">Aucune séquence créée.</p>}
      </div>
    </div>
  );
}
