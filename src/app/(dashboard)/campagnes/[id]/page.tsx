import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { CampaignLauncher } from "./campaign-launcher";
import { setCampaignStatus } from "@/lib/actions/campaigns";

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, userId },
    include: { sequence: { include: { steps: true } }, prospects: true },
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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">
            Statut : {campaign.status} · Séquence : {campaign.sequence?.name} ({campaign.sequence?.steps.length} étapes) ·
            {" "}{campaign.dailyLimit} emails/jour, {campaign.sendStartHour}h–{campaign.sendEndHour}h
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === "ACTIVE" && (
            <form action={async () => { "use server"; await setStatus("EN_PAUSE"); }}>
              <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" type="submit">Mettre en pause</button>
            </form>
          )}
          {campaign.status === "EN_PAUSE" && (
            <form action={async () => { "use server"; await setStatus("ACTIVE"); }}>
              <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" type="submit">Reprendre</button>
            </form>
          )}
          {(campaign.status === "ACTIVE" || campaign.status === "EN_PAUSE") && (
            <form action={async () => { "use server"; await setStatus("TERMINEE"); }}>
              <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" type="submit">Arrêter</button>
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
        <p className="text-sm text-muted-foreground">
          {campaign.prospects.length} prospect(s) inclus dans cette campagne.
        </p>
      )}
    </div>
  );
}
