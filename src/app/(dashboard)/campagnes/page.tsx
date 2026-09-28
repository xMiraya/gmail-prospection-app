import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  PROGRAMMEE: "Programmée",
  ACTIVE: "Active",
  EN_PAUSE: "En pause",
  TERMINEE: "Terminée",
};

export default async function CampaignsPage() {
  const userId = await requireUserId();
  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    include: { prospects: true, sequence: true },
    orderBy: { createdAt: "desc" },
  });
  const sequences = await prisma.sequence.findMany({ where: { userId } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campagnes</h1>
        <Link href="/campagnes/new" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Nouvelle campagne
        </Link>
      </div>

      {sequences.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-3">
          Créez d'abord une séquence dans "Séquences" avant de lancer une campagne.
        </p>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Link key={c.id} href={`/campagnes/${c.id}`} className="block rounded-lg border bg-card p-4 hover:border-primary/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.prospects.length} prospect(s) · séquence : {c.sequence?.name ?? "aucune"}
                </p>
              </div>
              <span className="badge bg-accent text-primary">{STATUS_LABELS[c.status]}</span>
            </div>
          </Link>
        ))}
        {campaigns.length === 0 && <p className="text-sm text-muted-foreground">Aucune campagne créée.</p>}
      </div>
    </div>
  );
}
