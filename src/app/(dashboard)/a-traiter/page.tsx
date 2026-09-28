import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";

export default async function ATraiterPage() {
  const userId = await requireUserId();

  const [replied, needsVerification, failed, interested] = await Promise.all([
    prisma.prospect.findMany({ where: { userId, status: "A_REPONDU" }, take: 50 }),
    prisma.scheduledEmail.findMany({
      where: { userId, missingVariables: { isEmpty: false }, status: { in: ["A_VALIDER", "MODIFIE"] } },
      include: { prospect: true },
      take: 50,
    }),
    prisma.scheduledEmail.findMany({ where: { userId, status: "ECHEC" }, include: { prospect: true }, take: 50 }),
    prisma.prospect.findMany({ where: { userId, status: { in: ["INTERESSE", "RENDEZ_VOUS"] } }, take: 50 }),
  ]);

  const Section = ({ title, count, children }: { title: string; count: number; children: React.ReactNode }) => (
    <div className="space-y-2">
      <h2 className="font-semibold text-sm">{title} ({count})</h2>
      <div className="rounded-lg border bg-card divide-y">{children}</div>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">À traiter</h1>
        <p className="text-muted-foreground text-sm mt-1">Tout ce qui demande une intervention humaine aujourd'hui.</p>
      </div>

      <Section title="Prospects ayant répondu" count={replied.length}>
        {replied.map((p) => (
          <Link key={p.id} href={`/prospects/${p.id}`} className="block px-4 py-3 text-sm hover:bg-muted/40">
            {p.firstName} {p.lastName} — {p.email}
          </Link>
        ))}
        {replied.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Variables manquantes (email non envoyable)" count={needsVerification.length}>
        {needsVerification.map((e) => (
          <Link key={e.id} href="/a-valider" className="block px-4 py-3 text-sm hover:bg-muted/40">
            {e.prospect.firstName} {e.prospect.lastName} — manque : {e.missingVariables.join(", ")}
          </Link>
        ))}
        {needsVerification.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Échecs d'envoi" count={failed.length}>
        {failed.map((e) => (
          <div key={e.id} className="px-4 py-3 text-sm">
            {e.prospect.firstName} {e.prospect.lastName} — {e.failReason}
          </div>
        ))}
        {failed.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>

      <Section title="Prospects intéressés / RDV à confirmer" count={interested.length}>
        {interested.map((p) => (
          <Link key={p.id} href={`/prospects/${p.id}`} className="block px-4 py-3 text-sm hover:bg-muted/40">
            {p.firstName} {p.lastName} — {p.status}
          </Link>
        ))}
        {interested.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Rien à traiter.</p>}
      </Section>
    </div>
  );
}
