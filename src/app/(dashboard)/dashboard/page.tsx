import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const content = (
    <div className="rounded-lg border bg-card p-4 hover:border-primary/40 transition-colors">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default async function DashboardPage() {
  const userId = await requireUserId();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const [
    totalProspects,
    newProspects,
    contacted,
    sentToday,
    sentThisWeek,
    replies,
    positiveReplies,
    scheduledFollowUps,
    activeCampaigns,
    toValidate,
    followUpsToValidate,
    modified,
    programmed,
    rejected,
  ] = await Promise.all([
    prisma.prospect.count({ where: { userId } }),
    prisma.prospect.count({ where: { userId, status: "NOUVEAU" } }),
    prisma.prospect.count({ where: { userId, lastContactAt: { not: null } } }),
    prisma.emailMessage.count({ where: { userId, direction: "OUTBOUND", sentAt: { gte: startOfToday } } }),
    prisma.emailMessage.count({ where: { userId, direction: "OUTBOUND", sentAt: { gte: startOfWeek } } }),
    prisma.emailMessage.count({ where: { userId, direction: "INBOUND" } }),
    prisma.prospect.count({ where: { userId, status: { in: ["INTERESSE", "RENDEZ_VOUS", "CLIENT"] } } }),
    prisma.scheduledEmail.count({ where: { userId, status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] }, sequenceStepId: { not: null } } }),
    prisma.campaign.count({ where: { userId, status: "ACTIVE" } }),
    prisma.scheduledEmail.count({ where: { userId, status: "A_VALIDER", scheduledFor: { lte: new Date(new Date().setHours(23, 59, 59, 999)) } } }),
    prisma.scheduledEmail.count({ where: { userId, status: "A_VALIDER", sequenceStepId: { not: null } } }),
    prisma.scheduledEmail.count({ where: { userId, status: "MODIFIE" } }),
    prisma.scheduledEmail.count({ where: { userId, status: { in: ["VALIDE", "PROGRAMME"] } } }),
    prisma.scheduledEmail.count({ where: { userId, status: "REFUSE" } }),
  ]);

  const totalSent = await prisma.emailMessage.count({ where: { userId, direction: "OUTBOUND" } });
  const responseRate = totalSent > 0 ? ((replies / totalSent) * 100).toFixed(1) : "0.0";
  const positiveRate = totalSent > 0 ? ((positiveReplies / totalSent) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de votre prospection.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Validation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Emails à valider aujourd'hui" value={toValidate} href="/a-valider" />
          <StatCard label="Relances à valider" value={followUpsToValidate} href="/a-valider" />
          <StatCard label="Emails programmés" value={programmed} href="/a-valider?status=PROGRAMME" />
          <StatCard label="Emails refusés" value={rejected} href="/a-valider?status=REFUSE" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Prospects</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Prospects totaux" value={totalProspects} href="/prospects" />
          <StatCard label="Nouveaux prospects" value={newProspects} href="/prospects?status=NOUVEAU" />
          <StatCard label="Prospects contactés" value={contacted} />
          <StatCard label="Campagnes actives" value={activeCampaigns} href="/campagnes" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Emails</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Envoyés aujourd'hui" value={sentToday} />
          <StatCard label="Envoyés cette semaine" value={sentThisWeek} />
          <StatCard label="Relances programmées" value={scheduledFollowUps} />
          <StatCard label="Réponses obtenues" value={replies} href="/reponses" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Taux de réponse" value={`${responseRate}%`} />
          <StatCard label="Taux de réponse positive" value={`${positiveRate}%`} />
          <StatCard label="Prospects à traiter" value={replies} href="/a-traiter" />
        </div>
      </section>
    </div>
  );
}
