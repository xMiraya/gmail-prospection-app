import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { VISIBLE_MESSAGE_TYPES } from "@/lib/gmail/message-filter";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/empty-state";
import { DashboardChart } from "./dashboard-chart";
import {
  CheckSquare,
  Mail,
  Send,
  MessageSquare,
  Sparkles,
  CalendarClock,
  Megaphone,
  ArrowRight,
  Inbox,
} from "lucide-react";

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  icon: React.ElementType;
  tone?: "default" | "brand" | "warning" | "success";
}) {
  const toneClasses = {
    default: "bg-secondary text-secondary-foreground",
    brand: "bg-brand/10 text-brand",
    warning: "bg-warning/15 text-warning-foreground dark:text-warning",
    success: "bg-success/10 text-success",
  }[tone];

  const content = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-5 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold mt-2 tabular-nums">{value}</p>
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneClasses}`}>
          <Icon size={16} />
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function initials(name?: string | null) {
  return (name || "?")
    .split(/[\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function timeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

export default async function DashboardPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    toValidate,
    followUpsToValidate,
    programmedToday,
    repliesTotal,
    positiveReplies,
    meetings,
    activeCampaigns,
    recentActivity,
    recentReplies,
    campaigns,
    hasAnyProspect,
  ] = await Promise.all([
    prisma.scheduledEmail.count({ where: { userId, status: { in: ["A_VALIDER", "MODIFIE"] } } }),
    prisma.scheduledEmail.count({ where: { userId, status: { in: ["A_VALIDER", "MODIFIE"] }, sequenceStepId: { not: null } } }),
    prisma.scheduledEmail.count({
      where: { userId, status: { in: ["VALIDE", "PROGRAMME"] }, scheduledFor: { gte: startOfToday } },
    }),
    prisma.emailMessage.count({ where: { userId, direction: "INBOUND", messageType: { in: VISIBLE_MESSAGE_TYPES } } }),
    prisma.prospect.count({ where: { userId, status: { in: ["INTERESSE", "RENDEZ_VOUS", "CLIENT"] } } }),
    prisma.prospect.count({ where: { userId, status: "RENDEZ_VOUS" } }),
    prisma.campaign.count({ where: { userId, status: "ACTIVE" } }),
    prisma.activity.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8, include: { prospect: true } }),
    prisma.emailMessage.findMany({
      where: { userId, direction: "INBOUND", messageType: { in: VISIBLE_MESSAGE_TYPES }, prospectId: { not: null } },
      orderBy: { sentAt: "desc" },
      take: 4,
      include: { prospect: true },
    }),
    prisma.campaign.findMany({
      where: { userId, status: "ACTIVE" },
      take: 4,
      include: { prospects: true, emailMessages: true },
    }),
    prisma.prospect.count({ where: { userId } }),
  ]);

  const messages = await prisma.emailMessage.findMany({
    where: { userId, sentAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) } },
    select: { direction: true, sentAt: true },
  });
  const byDay: Record<string, { envoyes: number; reponses: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600_000);
    byDay[d.toLocaleDateString("fr-FR", { weekday: "short" })] = { envoyes: 0, reponses: 0 };
  }
  for (const m of messages) {
    const key = m.sentAt.toLocaleDateString("fr-FR", { weekday: "short" });
    if (!byDay[key]) continue;
    if (m.direction === "OUTBOUND") byDay[key].envoyes++;
    else byDay[key].reponses++;
  }
  const chartData = Object.entries(byDay).map(([day, v]) => ({ day, ...v }));

  const activityLabels: Record<string, string> = {
    EMAIL_PREPARED: "Email préparé",
    EMAIL_EDITED: "Email modifié",
    EMAIL_APPROVED: "Email validé",
    EMAIL_SENT: "Email envoyé",
    EMAIL_FAILED: "Échec d'envoi",
    EMAIL_SCHEDULED: "Email programmé",
    EMAIL_CANCELLED: "Relance annulée",
    EMAIL_VALIDATED: "Email validé",
    EMAIL_REJECTED: "Email refusé",
    REPLY_RECEIVED: "Réponse reçue",
    REPLY_DETECTED: "Réponse détectée",
    FOLLOWUPS_CANCELLED: "Relances annulées",
    PROSPECT_CREATED: "Prospect créé",
    STATUS_CHANGED: "Statut modifié",
    CAMPAIGN_STARTED: "Campagne lancée",
    CAMPAIGN_PAUSED: "Campagne en pause",
    CAMPAIGN_FINISHED: "Campagne terminée",
  };

  if (hasAnyProspect === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <EmptyState
          icon={Sparkles}
          title={`Bienvenue${user.name ? `, ${user.name}` : ""} 👋`}
          description="Votre outil de prospection est prêt. Suivez le guide de démarrage pour être opérationnel en quelques minutes."
          actions={
            <>
              <Button asChild>
                <Link href="/onboarding">Commencer la configuration</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/prospects/import">Importer un CSV</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour{user.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {toValidate > 0
            ? `Vous avez ${toValidate} email${toValidate > 1 ? "s" : ""} à valider aujourd'hui.`
            : "Aucun email en attente de validation — tout est à jour."}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="À valider" value={toValidate} href="/a-valider" icon={CheckSquare} tone="brand" />
        <StatCard label="Relances à valider" value={followUpsToValidate} href="/a-valider" icon={Mail} />
        <StatCard label="Programmés aujourd'hui" value={programmedToday} href="/emails" icon={Send} />
        <StatCard label="Réponses reçues" value={repliesTotal} href="/reponses" icon={MessageSquare} tone="success" />
        <StatCard label="Prospects intéressés" value={positiveReplies} href="/pipeline" icon={Sparkles} tone="success" />
        <StatCard label="Rendez-vous" value={meetings} href="/pipeline" icon={CalendarClock} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activité des 7 derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Campagnes actives</CardTitle>
            <Badge variant="secondary">{activeCampaigns}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune campagne active pour le moment.</p>
            )}
            {campaigns.map((c) => {
              const sent = c.emailMessages.filter((m) => m.direction === "OUTBOUND").length;
              const replies = c.emailMessages.filter((m) => m.direction === "INBOUND").length;
              return (
                <Link
                  key={c.id}
                  href={`/campagnes/${c.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-secondary/40 transition-colors"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.prospects.length} prospects · {sent} envoyés · {replies} réponses</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                </Link>
              );
            })}
            <Button asChild variant="ghost" size="sm" className="w-full justify-center">
              <Link href="/campagnes">
                <Megaphone size={14} className="mr-1.5" /> Voir toutes les campagnes
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité pour le moment.</p>}
            {recentActivity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                <span className="flex-1">
                  {activityLabels[a.type] ?? a.type}
                  {a.prospect && <span className="text-muted-foreground"> — {a.prospect.firstName} {a.prospect.lastName}</span>}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(a.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Dernières réponses</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reponses">Tout voir</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentReplies.length === 0 && (
              <div className="py-6">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Inbox size={14} /> Aucune réponse pour le moment.
                </p>
              </div>
            )}
            {recentReplies.filter((r) => r.prospect).map((r) => (
              <Link
                key={r.id}
                href={`/prospects/${r.prospectId}`}
                className="flex items-center gap-3 py-2 border-b last:border-0 hover:bg-secondary/30 -mx-2 px-2 rounded-md transition-colors"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-brand/10 text-brand text-[10px]">
                    {initials(`${r.prospect!.firstName} ${r.prospect!.lastName ?? ""}`)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.prospect!.firstName} {r.prospect!.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.snippet}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{timeAgo(r.sentAt)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
