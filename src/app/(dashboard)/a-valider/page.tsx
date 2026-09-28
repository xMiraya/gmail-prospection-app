import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { ValidationQueue } from "./validation-queue";

export default async function AValiderPage() {
  const userId = await requireUserId();
  const drafts = await prisma.scheduledEmail.findMany({
    where: { userId, status: { in: ["A_VALIDER", "MODIFIE"] } },
    include: {
      prospect: { select: { firstName: true, lastName: true, company: { select: { name: true } } } },
      campaign: { select: { name: true } },
      sequenceStep: { select: { order: true } },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">À valider</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ces emails ont été préparés automatiquement mais n'ont pas encore été envoyés.
          Rien ne part sans votre validation explicite.
        </p>
      </div>
      <ValidationQueue
        drafts={drafts.map((d) => ({
          ...d,
          scheduledFor: d.scheduledFor.toISOString(),
        }))}
      />
    </div>
  );
}
