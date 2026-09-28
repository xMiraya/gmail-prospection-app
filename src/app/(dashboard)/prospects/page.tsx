import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { Prisma } from "@prisma/client";

const STATUS_LABELS: Record<string, string> = {
  NOUVEAU: "Nouveau",
  A_CONTACTER: "À contacter",
  EMAIL_PROGRAMME: "Email programmé",
  CONTACTE: "Contacté",
  RELANCE_1: "Relance 1",
  RELANCE_2: "Relance 2",
  RELANCE_3: "Relance 3",
  A_REPONDU: "A répondu",
  INTERESSE: "Intéressé",
  A_RAPPELER: "À rappeler",
  RENDEZ_VOUS: "Rendez-vous",
  PROPOSITION_ENVOYEE: "Proposition envoyée",
  PAS_INTERESSE: "Pas intéressé",
  CLIENT: "Client",
  NE_PLUS_CONTACTER: "Ne plus contacter",
  A_VERIFIER: "À vérifier",
};

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const userId = await requireUserId();

  const where: Prisma.ProspectWhereInput = {
    userId,
    ...(searchParams.status ? { status: searchParams.status as never } : {}),
    ...(searchParams.q
      ? {
          OR: [
            { firstName: { contains: searchParams.q, mode: "insensitive" } },
            { lastName: { contains: searchParams.q, mode: "insensitive" } },
            { email: { contains: searchParams.q, mode: "insensitive" } },
            { city: { contains: searchParams.q, mode: "insensitive" } },
            { sector: { contains: searchParams.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const prospects = await prisma.prospect.findMany({
    where,
    include: { company: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prospects</h1>
          <p className="text-muted-foreground text-sm mt-1">{prospects.length} prospects affichés</p>
        </div>
        <div className="flex gap-2">
          <Link href="/prospects/import" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
            Importer un CSV
          </Link>
          <Link href="/prospects/new" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
            Ajouter un prospect
          </Link>
        </div>
      </div>

      <form className="flex gap-2" action="/prospects">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Rechercher (nom, email, ville, secteur...)"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded-md border px-3 py-2 text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Filtrer</button>
      </form>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Nom</th>
              <th className="text-left px-4 py-2 font-medium">Entreprise</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Ville</th>
              <th className="text-left px-4 py-2 font-medium">Statut</th>
              <th className="text-left px-4 py-2 font-medium">Ajouté le</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-2">
                  <Link href={`/prospects/${p.id}`} className="font-medium hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.company?.name ?? "—"}</td>
                <td className="px-4 py-2">{p.email}</td>
                <td className="px-4 py-2">{p.city ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className="badge bg-accent text-primary">{STATUS_LABELS[p.status]}</span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {p.createdAt.toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
            {prospects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Aucun prospect. Importez un fichier CSV ou ajoutez-en un manuellement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
