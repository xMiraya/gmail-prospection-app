import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { createCampaign } from "@/lib/actions/campaigns";

export default async function NewCampaignPage() {
  const userId = await requireUserId();
  const sequences = await prisma.sequence.findMany({ where: { userId } });

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Nouvelle campagne</h1>
      <form action={createCampaign} className="space-y-4 rounded-lg border bg-card p-6">
        <div>
          <label className="text-sm font-medium">Nom de la campagne</label>
          <input name="name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Description</label>
          <textarea name="description" rows={2} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Séquence</label>
          <select name="sequenceId" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">Emails / jour</label>
            <input name="dailyLimit" type="number" defaultValue={25} min={1} max={200} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Heure début</label>
            <input name="sendStartHour" type="number" defaultValue={9} min={0} max={23} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Heure fin</label>
            <input name="sendEndHour" type="number" defaultValue={17} min={0} max={23} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Mode d'automatisation</label>
          <select name="automationMode" defaultValue="MANUEL" className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
            <option value="MANUEL">Manuel — je valide chaque email et chaque relance</option>
            <option value="SEMI_AUTOMATIQUE">Semi-automatique — relances préparées auto, à valider</option>
            <option value="AUTOMATIQUE">Automatique — envoi selon règles, après validation globale</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Créer la campagne
        </button>
      </form>
    </div>
  );
}
