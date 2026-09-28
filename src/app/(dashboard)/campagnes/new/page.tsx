import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { CampaignWizard } from "./campaign-wizard";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Workflow } from "lucide-react";
import Link from "next/link";

export default async function NewCampaignPage() {
  const userId = await requireUserId();
  const sequences = await prisma.sequence.findMany({
    where: { userId },
    include: { steps: { include: { template: true }, orderBy: { order: "asc" } } },
  });

  if (sequences.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="Créez d'abord une séquence"
        description="Une campagne s'appuie sur une séquence (email initial + relances). Créez-en une avant de lancer votre première campagne."
        actions={
          <Button asChild>
            <Link href="/sequences">Créer une séquence</Link>
          </Button>
        }
      />
    );
  }

  const prospects = await prisma.prospect.findMany({
    where: { userId, status: { notIn: ["NE_PLUS_CONTACTER", "CLIENT"] } },
    select: { id: true, firstName: true, lastName: true, email: true, city: true, sector: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return <CampaignWizard sequences={sequences} prospects={prospects} />;
}
