import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { RepliesInbox } from "./inbox";
import { SyncNowButton } from "./sync-now-button";
import { EmptyState } from "@/components/empty-state";
import { Inbox } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { VISIBLE_MESSAGE_TYPES } from "@/lib/gmail/message-filter";

export default async function ReponsesPage() {
  const userId = await requireUserId();

  const account = await prisma.googleAccount.findUnique({ where: { userId } });

  const [prospectsWithReplies, ignored] = await Promise.all([
    prisma.prospect.findMany({
      where: { userId, emailMessages: { some: { direction: "INBOUND", messageType: { in: VISIBLE_MESSAGE_TYPES } } } },
      include: {
        company: true,
        campaignProspects: { include: { campaign: true }, take: 1 },
        emailMessages: {
          where: { OR: [{ direction: "OUTBOUND" }, { direction: "INBOUND", messageType: { in: VISIBLE_MESSAGE_TYPES } }] },
          orderBy: { sentAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.emailMessage.findMany({
      where: { userId, direction: "INBOUND", prospectId: null },
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
  ]);

  const syncStatus = {
    connected: !!account?.connected,
    lastSyncAt: account?.lastSyncAt ? format(account.lastSyncAt, "d MMM yyyy à HH:mm", { locale: fr }) : null,
    lastSyncNewCount: account?.lastSyncNewCount ?? null,
    lastSyncError: account?.lastSyncError ?? null,
  };

  const ignoredList = ignored.map((m) => ({
    id: m.id,
    fromEmail: m.fromEmail ?? "",
    fromName: m.fromName,
    subject: m.subject,
    snippet: m.snippet,
    sentAt: m.sentAt.toISOString(),
    messageType: m.messageType ?? "OTHER",
    filterReason: m.filterReason,
  }));

  if (prospectsWithReplies.length === 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Réponses</h1>
            <p className="text-muted-foreground text-sm mt-1">Boîte intelligente : réponses de prospects, classées et prêtes à traiter.</p>
          </div>
          <SyncNowButton status={syncStatus} />
        </div>
        {ignoredList.length > 0 ? (
          <RepliesInbox conversations={[]} ignored={ignoredList} />
        ) : (
          <EmptyState
            icon={Inbox}
            title="Aucune réponse pour le moment"
            description="Cliquez sur « Synchroniser maintenant » pour récupérer les réponses réelles de votre boîte Gmail, ou attendez qu'un prospect réponde."
          />
        )}
      </div>
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
      classification: m.classification,
      messageType: m.messageType,
      filterReason: m.filterReason,
      priority: m.priority,
      importanceScore: m.importanceScore,
      draftReply: m.draftReply,
      draftStatus: m.draftStatus,
      draftSource: m.draftSource,
      draftNeedsInfo: m.draftNeedsInfo,
    })),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Réponses</h1>
          <p className="text-muted-foreground text-sm mt-1">{conversations.length} conversation(s) avec des prospects.</p>
        </div>
        <SyncNowButton status={syncStatus} />
      </div>
      <RepliesInbox conversations={conversations} ignored={ignoredList} />
    </div>
  );
}
