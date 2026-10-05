import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CheckCircle2 } from "lucide-react";
import { CLASSIFICATION_LABELS, type ReplyClassification } from "@/lib/gmail/classify";

export default async function ATraiterPage() {
  const userId = await requireUserId();

  const [replied, needsVerification, failed, interested, pendingReplies] = await Promise.all([
    prisma.prospect.findMany({ where: { userId, status: "A_REPONDU" }, take: 50 }),
    prisma.scheduledEmail.findMany({
      where: { userId, missingVariables: { isEmpty: false }, status: { in: ["A_VALIDER", "MODIFIE"] } },
      include: { prospect: true },
      take: 50,
    }),
    prisma.scheduledEmail.findMany({ where: { userId, status: "ECHEC" }, include: { prospect: true }, take: 50 }),
    prisma.prospect.findMany({ where: { userId, status: { in: ["INTERESSE", "RENDEZ_VOUS"] } }, take: 50 }),
    prisma.emailMessage.findMany({
      where: { userId, direction: "INBOUND", draftStatus: "PENDING", prospectId: { not: null } },
      include: { prospect: true },
      orderBy: [{ priority: "asc" }, { sentAt: "desc" }],
      take: 50,
    }),
  ]);

  const total = replied.length + needsVerification.length + failed.length + interested.length + pendingReplies.length;

  const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title} <Badge variant="secondary" className="ml-1">{count}</Badge></CardTitle></CardHeader>
      <CardContent className="p-0 divide-y">{children}</CardContent>
    </Card>
  );

  if (total === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Rien à traiter"
        description="Aucune action urgente pour le moment. Revenez ici dès qu'un prospect répond ou qu'un envoi échoue."
      />
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">À traiter</h1>
        <p className="text-muted-foreground text-sm mt-1">Tout ce qui demande une intervention humaine aujourd'hui.</p>
      </div>

      <Section title="Réponses Gmail à traiter" count={pendingReplies.length}>
        {pendingReplies.map((m) => (
          <Link key={m.id} href="/reponses" className="block px-4 py-3 text-sm hover:bg-secondary/40">
            {m.prospect?.firstName} {m.prospect?.lastName} — <span className="text-muted-foreground">{m.subject}</span>
            {m.classification && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {CLASSIFICATION_LABELS[m.classification as ReplyClassification] ?? m.classification}
              </Badge>
            )}
            {m.importanceScore >= 90 && (
              <Badge variant="destructive" className="ml-1 text-[10px]">Urgent</Badge>
            )}
          </Link>
        ))}
        {pendingReplies.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Prospects ayant répondu" count={replied.length}>
        {replied.map((p) => (
          <Link key={p.id} href={`/prospects/${p.id}`} className="block px-4 py-3 text-sm hover:bg-secondary/40">
            {p.firstName} {p.lastName} — <span className="text-muted-foreground">{p.email}</span>
          </Link>
        ))}
        {replied.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Variables manquantes (email non envoyable)" count={needsVerification.length}>
        {needsVerification.map((e) => (
          <Link key={e.id} href="/a-valider" className="block px-4 py-3 text-sm hover:bg-secondary/40">
            {e.prospect.firstName} {e.prospect.lastName} — manque : {e.missingVariables.join(", ")}
          </Link>
        ))}
        {needsVerification.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Échecs d'envoi" count={failed.length}>
        {failed.map((e) => (
          <div key={e.id} className="px-4 py-3 text-sm">
            {e.prospect.firstName} {e.prospect.lastName} — <span className="text-muted-foreground">{e.failReason}</span>
          </div>
        ))}
        {failed.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Prospects intéressés / RDV à confirmer" count={interested.length}>
        {interested.map((p) => (
          <Link key={p.id} href={`/prospects/${p.id}`} className="block px-4 py-3 text-sm hover:bg-secondary/40">
            {p.firstName} {p.lastName} — {p.status}
          </Link>
        ))}
        {interested.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>
    </div>
  );
}
