import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { DailyChart } from "./chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { BarChart3, Send, MessageSquare, Percent, Sparkles, CalendarClock, Award } from "lucide-react";

export default async function StatistiquesPage() {
  const userId = await requireUserId();

  const totalSent = await prisma.emailMessage.count({ where: { userId, direction: "OUTBOUND" } });

  if (totalSent === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Pas encore de statistiques"
        description="Vos statistiques de prospection apparaîtront ici dès que vous aurez envoyé vos premiers emails."
      />
    );
  }

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

  const campaigns = await prisma.campaign.findMany({ where: { userId }, include: { emailMessages: true, prospects: true } });
  const campaignStats = campaigns.map((c) => {
    const sent = c.emailMessages.filter((m) => m.direction === "OUTBOUND").length;
    const replies = c.emailMessages.filter((m) => m.direction === "INBOUND").length;
    return { name: c.name, sent, replies, rate: sent > 0 ? ((replies / sent) * 100).toFixed(1) : "0.0" };
  });

  const templates = await prisma.emailTemplate.findMany({ where: { userId }, include: { emailMessages: true } });
  const templateStats = templates
    .map((t) => {
      const sent = t.emailMessages.filter((m) => m.direction === "OUTBOUND").length;
      return { name: t.name, sent };
    })
    .filter((t) => t.sent > 0)
    .sort((a, b) => b.sent - a.sent);

  const totalReplies = await prisma.emailMessage.count({ where: { userId, direction: "INBOUND" } });
  const positive = await prisma.prospect.count({ where: { userId, status: { in: ["INTERESSE", "RENDEZ_VOUS", "CLIENT"] } } });
  const meetings = await prisma.prospect.count({ where: { userId, status: "RENDEZ_VOUS" } });
  const clients = await prisma.prospect.count({ where: { userId, status: "CLIENT" } });
  const rate = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : "0.0";

  const cards = [
    { label: "Emails envoyés", value: totalSent, icon: Send },
    { label: "Réponses", value: totalReplies, icon: MessageSquare },
    { label: "Taux de réponse", value: `${rate}%`, icon: Percent },
    { label: "Prospects intéressés", value: positive, icon: Sparkles },
    { label: "Rendez-vous", value: meetings, icon: CalendarClock },
    { label: "Clients obtenus", value: clients, icon: Award },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statistiques</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Uniquement des données mesurables de façon fiable via Gmail (pas de suivi d'ouverture).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <c.icon className="h-4 w-4 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold mt-1">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Emails envoyés / réponses (14 derniers jours)</CardTitle></CardHeader>
        <CardContent><DailyChart data={chartData} /></CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Performance par campagne</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Campagne</TableHead><TableHead>Envoyés</TableHead><TableHead>Réponses</TableHead><TableHead>Taux</TableHead></TableRow></TableHeader>
              <TableBody>
                {campaignStats.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell>{c.name}</TableCell><TableCell>{c.sent}</TableCell><TableCell>{c.replies}</TableCell><TableCell>{c.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Performance par template</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Template</TableHead><TableHead>Envoyés</TableHead></TableRow></TableHeader>
              <TableBody>
                {templateStats.map((t) => (
                  <TableRow key={t.name}><TableCell>{t.name}</TableCell><TableCell>{t.sent}</TableCell></TableRow>
                ))}
                {templateStats.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Aucune donnée.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
