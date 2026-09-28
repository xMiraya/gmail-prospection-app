import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { CampaignLauncher } from "./campaign-launcher";
import { setCampaignStatus } from "@/lib/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProspectStatusBadge } from "@/components/status-badge";
import Link from "next/link";
import { Pause, Play, Square } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon", PROGRAMMEE: "Programmée", ACTIVE: "Active", EN_PAUSE: "En pause", TERMINEE: "Terminée",
};

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, userId },
    include: {
      sequence: { include: { steps: true } },
      prospects: { include: { prospect: { include: { company: true } } } },
    },
  });
  if (!campaign) notFound();

  const availableProspects = await prisma.prospect.findMany({
    where: {
      userId,
      status: { notIn: ["NE_PLUS_CONTACTER", "CLIENT"] },
      id: { notIn: campaign.prospects.map((p) => p.prospectId) },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 500,
  });

  const setStatus = setCampaignStatus.bind(null, campaign.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <Badge variant="secondary">{STATUS_LABELS[campaign.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Séquence : {campaign.sequence?.name} ({campaign.sequence?.steps.length} étapes) · {campaign.dailyLimit} emails/jour, {campaign.sendStartHour}h–{campaign.sendEndHour}h
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === "ACTIVE" && (
            <form action={async () => { "use server"; await setStatus("EN_PAUSE"); }}>
              <Button variant="outline" size="sm" type="submit"><Pause className="mr-1.5" /> Mettre en pause</Button>
            </form>
          )}
          {campaign.status === "EN_PAUSE" && (
            <form action={async () => { "use server"; await setStatus("ACTIVE"); }}>
              <Button variant="outline" size="sm" type="submit"><Play className="mr-1.5" /> Reprendre</Button>
            </form>
          )}
          {(campaign.status === "ACTIVE" || campaign.status === "EN_PAUSE") && (
            <form action={async () => { "use server"; await setStatus("TERMINEE"); }}>
              <Button variant="outline" size="sm" type="submit"><Square className="mr-1.5" /> Arrêter</Button>
            </form>
          )}
        </div>
      </div>

      {campaign.status === "BROUILLON" ? (
        <div>
          <h2 className="font-semibold mb-3">Sélectionner les prospects à contacter</h2>
          <CampaignLauncher campaignId={campaign.id} prospects={availableProspects} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Étape actuelle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.prospects.map((cp) => (
                  <TableRow key={cp.prospectId}>
                    <TableCell>
                      <Link href={`/prospects/${cp.prospectId}`} className="hover:underline font-medium">
                        {cp.prospect.firstName} {cp.prospect.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cp.prospect.company?.name ?? "—"}</TableCell>
                    <TableCell><ProspectStatusBadge status={cp.prospect.status} /></TableCell>
                    <TableCell><Badge variant="outline">{cp.currentStepOrder === 0 ? "Premier email" : `Relance ${cp.currentStepOrder}`}</Badge></TableCell>
                  </TableRow>
                ))}
                {campaign.prospects.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun prospect dans cette campagne.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
