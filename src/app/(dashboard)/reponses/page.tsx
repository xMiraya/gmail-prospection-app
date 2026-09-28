import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { ClassifySelect } from "./classify-select";

export default async function ReponsesPage() {
  const userId = await requireUserId();
  const replies = await prisma.emailMessage.findMany({
    where: { userId, direction: "INBOUND" },
    include: { prospect: { include: { company: true } }, campaign: true },
    orderBy: { sentAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Réponses</h1>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Prospect</th>
              <th className="text-left px-4 py-2">Entreprise</th>
              <th className="text-left px-4 py-2">Campagne</th>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Extrait</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="text-left px-4 py-2">Classifier</th>
            </tr>
          </thead>
          <tbody>
            {replies.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">
                  <Link href={`/prospects/${r.prospectId}`} className="hover:underline font-medium">
                    {r.prospect.firstName} {r.prospect.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2">{r.prospect.company?.name ?? "—"}</td>
                <td className="px-4 py-2">{r.campaign?.name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.sentAt.toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-2 max-w-xs truncate">{r.snippet}</td>
                <td className="px-4 py-2">{r.prospect.status}</td>
                <td className="px-4 py-2">
                  <ClassifySelect prospectId={r.prospectId} current={r.prospect.status} />
                </td>
              </tr>
            ))}
            {replies.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucune réponse pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
