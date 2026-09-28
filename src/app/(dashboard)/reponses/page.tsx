import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { RepliesInbox } from "./inbox";
import { EmptyState } from "@/components/empty-state";
import { Inbox } from "lucide-react";

export default async function ReponsesPage() {
  const userId = await requireUserId();

  const prospectsWithReplies = await prisma.prospect.findMany({
    where: { userId, emailMessages: { some: { direction: "INBOUND" } } },
    include: {
      company: true,
      campaignProspects: { include: { campaign: true }, take: 1 },
      emailMessages: { orderBy: { sentAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (prospectsWithReplies.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Aucune réponse pour le moment"
        description="Dès qu'un prospect répond à l'un de vos emails, la conversation apparaîtra ici."
      />
    );
  }

  const conversations = prospectsWithReplies.map((p) => ({
    id: p.id,
    prospectId: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    company: p.company?.name ?? null,
    campaign: p.campaignProspects[0]?.campaign.name ?? null,
    status: p.status,
    messages: p.emailMessages.map((m) => ({
      id: m.id,
      direction: m.direction,
      subject: m.subject,
      bodyHtml: m.bodyHtml,
      snippet: m.snippet,
      sentAt: m.sentAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réponses</h1>
        <p className="text-muted-foreground text-sm mt-1">{conversations.length} conversation(s) avec des prospects.</p>
      </div>
      <RepliesInbox conversations={conversations} />
    </div>
  );
}
