import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

export default async function EmailsPage() {
  const userId = await requireUserId();
  const messages = await prisma.emailMessage.findMany({
    where: { userId },
    include: { prospect: true, campaign: true },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Emails</h1>
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Sens</th>
              <th className="text-left px-4 py-2">Prospect</th>
              <th className="text-left px-4 py-2">Objet</th>
              <th className="text-left px-4 py-2">Campagne</th>
              <th className="text-left px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2">
                  <span className={`badge ${m.direction === "OUTBOUND" ? "bg-accent text-primary" : "bg-green-100 text-green-800"}`}>
                    {m.direction === "OUTBOUND" ? "Envoyé" : "Reçu"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link href={`/prospects/${m.prospectId}`} className="hover:underline">
                    {m.prospect.firstName} {m.prospect.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2 max-w-sm truncate">{m.subject}</td>
                <td className="px-4 py-2">{m.campaign?.name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{m.sentAt.toLocaleString("fr-FR")}</td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucun email pour le moment.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
