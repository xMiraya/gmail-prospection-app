import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Mail } from "lucide-react";
import { VISIBLE_MESSAGE_TYPES } from "@/lib/gmail/message-filter";

export default async function EmailsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const userId = await requireUserId();
  const filter = searchParams.filter ?? "tous";

  const [sentAndReceived, drafts, failed] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { userId, OR: [{ direction: "OUTBOUND" }, { direction: "INBOUND", messageType: { in: VISIBLE_MESSAGE_TYPES } }] },
      include: { prospect: true, campaign: true },
      orderBy: { sentAt: "desc" },
      take: 200,
    }),
    prisma.scheduledEmail.findMany({ where: { userId, status: { in: ["A_VALIDER", "MODIFIE", "VALIDE", "PROGRAMME"] } }, include: { prospect: true, campaign: true }, orderBy: { scheduledFor: "desc" }, take: 200 }),
    prisma.scheduledEmail.findMany({ where: { userId, status: "ECHEC" }, include: { prospect: true, campaign: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  type Row = { id: string; prospectName: string; prospectId: string; subject: string; campaign: string; date: Date; status: string; variant: "brand" | "secondary" | "success" | "destructive" | "warning" };

  const rows: Row[] = [
    ...sentAndReceived
      .filter((m) => m.prospect)
      .map((m) => ({
        id: m.id, prospectId: m.prospectId!,
        prospectName: `${m.prospect!.firstName} ${m.prospect!.lastName ?? ""}`,
        subject: m.subject, campaign: m.campaign?.name ?? "—", date: m.sentAt,
        status: m.direction === "OUTBOUND" ? "Envoyé" : "Réponse",
        variant: (m.direction === "OUTBOUND" ? "brand" : "success") as Row["variant"],
      })),
    ...drafts.map((d) => ({
      id: d.id, prospectId: d.prospectId,
      prospectName: `${d.prospect.firstName} ${d.prospect.lastName ?? ""}`,
      subject: d.subject, campaign: d.campaign?.name ?? "—", date: d.scheduledFor,
      status: d.status === "VALIDE" || d.status === "PROGRAMME" ? "Programmé" : "À valider",
      variant: (d.status === "VALIDE" || d.status === "PROGRAMME" ? "secondary" : "warning") as Row["variant"],
    })),
    ...failed.map((f) => ({
      id: f.id, prospectId: f.prospectId,
      prospectName: `${f.prospect.firstName} ${f.prospect.lastName ?? ""}`,
      subject: f.subject, campaign: f.campaign?.name ?? "—", date: f.updatedAt,
      status: "Échec", variant: "destructive" as Row["variant"],
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const filterMap: Record<string, string> = { tous: "Tous", "a-valider": "À valider", programmes: "Programmés", envoyes: "Envoyés", reponses: "Réponses", echecs: "Échecs" };
  const filtered = rows.filter((r) => {
    if (filter === "tous") return true;
    if (filter === "a-valider") return r.status === "À valider";
    if (filter === "programmes") return r.status === "Programmé";
    if (filter === "envoyes") return r.status === "Envoyé";
    if (filter === "reponses") return r.status === "Réponse";
    if (filter === "echecs") return r.status === "Échec";
    return true;
  });

  if (rows.length === 0) {
    return <EmptyState icon={Mail} title="Aucun email" description="Vos emails de prospection (envoyés, programmés ou reçus) apparaîtront ici." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de tous vos emails de prospection.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(filterMap).map(([key, label]) => (
          <Link key={key} href={key === "tous" ? "/emails" : `/emails?filter=${key}`}>
            <Badge variant={filter === key ? "brand" : "outline"} className="cursor-pointer">{label}</Badge>
          </Link>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Campagne</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/prospects/${r.prospectId}`} className="hover:underline font-medium">{r.prospectName}</Link>
                </TableCell>
                <TableCell className="max-w-xs truncate">{r.subject}</TableCell>
                <TableCell className="text-muted-foreground">{r.campaign}</TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{r.date.toLocaleDateString("fr-FR")}</TableCell>
                <TableCell><Badge variant={r.variant}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
