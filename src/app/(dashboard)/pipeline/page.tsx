import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { PipelineBoard } from "./pipeline-board";

export default async function PipelinePage() {
  const userId = await requireUserId();
  const prospects = await prisma.prospect.findMany({
    where: { userId, status: { notIn: ["NE_PLUS_CONTACTER", "A_VERIFIER"] } },
    select: { id: true, firstName: true, lastName: true, status: true, company: { select: { name: true } } },
    take: 300,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-muted-foreground text-sm mt-1">Glissez-déposez un prospect pour changer son statut.</p>
      </div>
      <PipelineBoard prospects={prospects} />
    </div>
  );
}
