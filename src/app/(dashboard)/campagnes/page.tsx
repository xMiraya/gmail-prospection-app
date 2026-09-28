import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Megaphone, Plus } from "lucide-react";

const STATUS_VARIANT: Record<string, "secondary" | "brand" | "success" | "warning" | "outline"> = {
  BROUILLON: "outline",
  PROGRAMMEE: "secondary",
  ACTIVE: "success",
  EN_PAUSE: "warning",
  TERMINEE: "secondary",
};
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
    include: { prospects: true, sequence: true, emailMessages: true },
    orderBy: { createdAt: "desc" },
  });
  const sequences = await prisma.sequence.count({ where: { userId } });

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="Aucune campagne pour le moment"
        description={
          sequences === 0
            ? "Créez d'abord une séquence, puis lancez votre première campagne de prospection."
            : "Créez votre première campagne pour commencer à contacter vos prospects."
        }
        actions={
          <Button asChild disabled={sequences === 0}>
            <Link href={sequences === 0 ? "/sequences" : "/campagnes/new"}>
              <Plus className="mr-1.5" /> {sequences === 0 ? "Créer une séquence" : "Nouvelle campagne"}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campagnes</h1>
          <p className="text-muted-foreground text-sm mt-1">{campaigns.length} campagne(s)</p>
        </div>
        <Button asChild>
          <Link href="/campagnes/new"><Plus className="mr-1.5" /> Nouvelle campagne</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {campaigns.map((c) => {
          const sent = c.emailMessages.filter((m) => m.direction === "OUTBOUND").length;
          const replies = c.emailMessages.filter((m) => m.direction === "INBOUND").length;
          const rate = sent > 0 ? ((replies / sent) * 100).toFixed(0) : "0";
          return (
            <Link key={c.id} href={`/campagnes/${c.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold">{c.name}</p>
                    <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Créée le {c.createdAt.toLocaleDateString("fr-FR")}</p>
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t text-center">
                    <div><p className="text-lg font-semibold">{c.prospects.length}</p><p className="text-[11px] text-muted-foreground">Prospects</p></div>
                    <div><p className="text-lg font-semibold">{sent}</p><p className="text-[11px] text-muted-foreground">Envoyés</p></div>
                    <div><p className="text-lg font-semibold">{replies}</p><p className="text-[11px] text-muted-foreground">Réponses</p></div>
                    <div><p className="text-lg font-semibold">{rate}%</p><p className="text-[11px] text-muted-foreground">Taux</p></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
