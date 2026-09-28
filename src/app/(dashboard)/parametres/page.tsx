import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { updateSettings, addToBlacklist, removeFromBlacklist } from "@/lib/actions/settings";

const DAYS = [
  { value: 1, label: "Lundi" }, { value: 2, label: "Mardi" }, { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" }, { value: 5, label: "Vendredi" }, { value: 6, label: "Samedi" }, { value: 0, label: "Dimanche" },
];

export default async function ParametresPage() {
  const userId = await requireUserId();
  const [settings, user, blacklist] = await Promise.all([
    prisma.prospectionSettings.findUnique({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.blacklist.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Paramètres</h1>

      <form action={updateSettings} className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Automatisation</h2>
        <p className="text-xs text-muted-foreground">
          Par défaut, aucune prospection ne part sans validation humaine (mode Manuel).
        </p>
        <select name="automationMode" defaultValue={settings?.automationMode ?? "MANUEL"} className="w-full rounded-md border px-3 py-2 text-sm">
          <option value="MANUEL">Manuel — je valide chaque email et chaque relance</option>
          <option value="SEMI_AUTOMATIQUE">Semi-automatique — relances préparées auto, à valider</option>
          <option value="AUTOMATIQUE">Automatique — envoi selon règles, après validation globale de la campagne</option>
        </select>

        <h2 className="font-semibold pt-2">Limites d'envoi</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Emails maximum / jour</label>
            <input name="dailyLimit" type="number" defaultValue={settings?.dailyLimit ?? 25} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Intervalle minimum (minutes)</label>
            <input name="minIntervalMin" type="number" defaultValue={settings?.minIntervalMin ?? 3} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Heure de début</label>
            <input name="sendStartHour" type="number" min={0} max={23} defaultValue={settings?.sendStartHour ?? 9} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Heure de fin</label>
            <input name="sendEndHour" type="number" min={0} max={23} defaultValue={settings?.sendEndHour ?? 17} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Relances maximum</label>
            <input name="maxFollowUps" type="number" defaultValue={settings?.maxFollowUps ?? 3} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>

        <h2 className="font-semibold pt-2">Jours d'envoi</h2>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="sendDays"
                value={d.value}
                defaultChecked={(settings?.sendDays ?? [1, 2, 3, 4, 5]).includes(d.value)}
              />
              {d.label}
            </label>
          ))}
        </div>

        <h2 className="font-semibold pt-2">Signature</h2>
        <textarea name="signatureHtml" defaultValue={user.signatureHtml ?? ""} rows={4} className="w-full rounded-md border px-3 py-2 text-sm" />

        <button type="submit" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Enregistrer
        </button>
      </form>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Blacklist</h2>
        <form action={addToBlacklist} className="flex gap-2">
          <input name="email" placeholder="email@exemple.fr" className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <input name="domain" placeholder="ou domaine.fr" className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <input name="reason" placeholder="Raison" className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button className="rounded-md border px-4 py-2 text-sm hover:bg-muted" type="submit">Ajouter</button>
        </form>
        <ul className="text-sm divide-y">
          {blacklist.map((b) => (
            <li key={b.id} className="py-2 flex items-center justify-between">
              <span>{b.email ?? b.domain} — {b.reason}</span>
              <form action={async () => { "use server"; await removeFromBlacklist(b.id); }}>
                <button className="text-red-600 text-xs hover:underline" type="submit">Retirer</button>
              </form>
            </li>
          ))}
          {blacklist.length === 0 && <p className="text-muted-foreground text-sm py-2">Liste vide.</p>}
        </ul>
      </div>
    </div>
  );
}
