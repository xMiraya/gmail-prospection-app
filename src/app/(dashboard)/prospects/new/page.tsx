import { createProspect } from "@/lib/actions/prospects";

export default function NewProspectPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Ajouter un prospect</h1>
      <form action={createProspect} className="space-y-4 rounded-lg border bg-card p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Prénom *</label>
            <input name="firstName" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Nom</label>
            <input name="lastName" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Email *</label>
          <input name="email" type="email" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Téléphone</label>
            <input name="phone" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Site internet</label>
            <input name="website" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Ville</label>
            <input name="city" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Secteur</label>
            <input name="sector" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Source</label>
          <input name="source" placeholder="LinkedIn, salon, recommandation..." className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Notes</label>
          <textarea name="notes" rows={3} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Créer le prospect
        </button>
      </form>
    </div>
  );
}
