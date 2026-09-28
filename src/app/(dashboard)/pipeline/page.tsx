import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { PipelineBoard } from "./pipeline-board";
import { EmptyState } from "@/components/empty-state";
import { Kanban } from "lucide-react";

export default async function PipelinePage() {
  const userId = await requireUserId();
  const prospects = await prisma.prospect.findMany({
    where: { userId, status: { notIn: ["NE_PLUS_CONTACTER", "A_VERIFIER"] } },
    select: { id: true, firstName: true, lastName: true, status: true, company: { select: { name: true } } },
    take: 300,
  });

  if (prospects.length === 0) {
    return <EmptyState icon={Kanban} title="Pipeline vide" description="Vos prospects apparaîtront ici, organisés par étape commerciale, dès que vous en aurez ajouté." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Glissez-déposez un prospect pour changer son statut.</p>
      </div>
      <PipelineBoard prospects={prospects} />
    </div>
  );
}
