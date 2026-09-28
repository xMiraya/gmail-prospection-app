import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { DailyChart } from "./chart";

export default async function StatistiquesPage() {
  const userId = await requireUserId();

  const messages = await prisma.emailMessage.findMany({
    where: { userId, sentAt: { gte: new Date(Date.now() - 14 * 24 * 3600_000) } },
    select: { direction: true, sentAt: true },
  });

  const byDay: Record<string, { envoyes: number; reponses: number }> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600_000);
    byDay[d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })] = { envoyes: 0, reponses: 0 };
  }
  for (const m of messages) {
    const key = m.sentAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    if (!byDay[key]) continue;
    if (m.direction === "OUTBOUND") byDay[key].envoyes++;
    else byDay[key].reponses++;
  }
  const chartData = Object.entries(byDay).map(([day, v]) => ({ day, ...v }));

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    include: { emailMessages: true, prospects: true },
  });

  const campaignStats = campaigns.map((c) => {
    const sent = c.emailMessages.filter((m) => m.direction === "OUTBOUND").length;
    const replies = c.emailMessages.filter((m) => m.direction === "INBOUND").length;
    return {
      name: c.name,
      sent,
      replies,
      rate: sent > 0 ? ((replies / sent) * 100).toFixed(1) : "0.0",
    };
  });

  const totalSent = await prisma.emailMessage.count({ where: { userId, direction: "OUTBOUND" } });
  const totalReplies = await prisma.emailMessage.count({ where: { userId, direction: "INBOUND" } });
  const positive = await prisma.prospect.count({ where: { userId, status: { in: ["INTERESSE", "RENDEZ_VOUS", "CLIENT"] } } });
  const meetings = await prisma.prospect.count({ where: { userId, status: "RENDEZ_VOUS" } });
  const clients = await prisma.prospect.count({ where: { userId, status: "CLIENT" } });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Statistiques</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Uniquement des données mesurables de façon fiable via Gmail (pas de suivi d'ouverture).
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Emails envoyés</p><p className="text-2xl font-semibold">{totalSent}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Réponses</p><p className="text-2xl font-semibold">{totalReplies}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Prospects intéressés</p><p className="text-2xl font-semibold">{positive}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Rendez-vous</p><p className="text-2xl font-semibold">{meetings}</p></div>
        <div className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">Clients obtenus</p><p className="text-2xl font-semibold">{clients}</p></div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold text-sm mb-4">Emails envoyés / réponses par jour (14 derniers jours)</h2>
        <DailyChart data={chartData} />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <p className="px-4 py-2 font-semibold text-sm border-b">Performance par campagne</p>
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Campagne</th>
              <th className="text-left px-4 py-2">Envoyés</th>
              <th className="text-left px-4 py-2">Réponses</th>
              <th className="text-left px-4 py-2">Taux de réponse</th>
            </tr>
          </thead>
          <tbody>
            {campaignStats.map((c) => (
              <tr key={c.name} className="border-t">
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">{c.sent}</td>
                <td className="px-4 py-2">{c.replies}</td>
                <td className="px-4 py-2">{c.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
