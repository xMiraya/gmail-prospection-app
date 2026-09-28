import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { addSequenceStep, removeSequenceStep } from "@/lib/actions/sequences";
import { notFound } from "next/navigation";

export default async function SequenceDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const sequence = await prisma.sequence.findFirst({
    where: { id: params.id, userId },
    include: { steps: { include: { template: true }, orderBy: { order: "asc" } } },
  });
  if (!sequence) notFound();

  const templates = await prisma.emailTemplate.findMany({ where: { userId } });

  const addStep = addSequenceStep.bind(null, sequence.id);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">{sequence.name}</h1>

      <div className="space-y-3">
        {sequence.steps.map((step, i) => (
          <div key={step.id} className="rounded-lg border bg-card p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {i === 0 ? "Email initial (J0)" : `Relance ${i}`} — {step.template.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {i === 0 ? "Envoyé au lancement" : `${step.delayDays} jour(s) après l'étape précédente`}, vers {step.approxHour}h
              </p>
            </div>
            <form action={async () => { "use server"; await removeSequenceStep(sequence.id, step.id); }}>
              <button className="text-sm text-red-600 hover:underline" type="submit">Supprimer</button>
            </form>
          </div>
        ))}
        {sequence.steps.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune étape. Ajoutez l'email initial ci-dessous.</p>
        )}
      </div>

      <form action={addStep} className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Ajouter une étape</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium">Template</label>
            <select name="templateId" required className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Délai (jours après l'étape précédente)</label>
            <input name="delayDays" type="number" min={0} defaultValue={sequence.steps.length === 0 ? 0 : 3} className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium">Heure approximative</label>
            <input name="approxHour" type="number" min={0} max={23} defaultValue={9} className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" />
          </div>
        </div>
        <button className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium" type="submit">
          Ajouter l'étape
        </button>
      </form>
    </div>
  );
}
