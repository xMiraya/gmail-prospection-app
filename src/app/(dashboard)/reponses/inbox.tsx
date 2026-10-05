"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassifySelect } from "./classify-select";
import { DraftReplyPanel } from "./draft-reply-panel";
import { ExternalLink, ArchiveX } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSIFICATION_LABELS, type ReplyClassification } from "@/lib/gmail/classify";
import { MESSAGE_TYPE_LABELS, type MessageType } from "@/lib/gmail/message-filter";

export type Message = {
  id: string;
  direction: string;
  subject: string;
  bodyHtml: string | null;
  snippet: string | null;
  sentAt: string;
  classification: string | null;
  messageType: string | null;
  filterReason: string | null;
  priority: number;
  importanceScore: number;
  draftReply: string | null;
  draftStatus: string | null;
  draftSource: string | null;
  draftNeedsInfo: boolean;
};

export type Conversation = {
  id: string;
  prospectId: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  campaign: string | null;
  status: string;
  messages: Message[];
};

export type IgnoredMessage = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  snippet: string | null;
  sentAt: string;
  messageType: string;
  filterReason: string | null;
};

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

const CLASSIFICATION_VARIANT: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  INTERESSE: "success",
  DEMANDE_RDV: "success",
  DEMANDE_PRIX: "warning",
  DEMANDE_INFO: "warning",
  A_RAPPELER: "warning",
  DEJA_EQUIPE: "secondary",
  PAS_INTERESSE: "destructive",
  REPONSE_AUTOMATIQUE: "secondary",
  HORS_SUJET: "secondary",
  A_ANALYSER: "secondary",
};

type FilterTab = "TOUS" | "INTERESSE" | "DEMANDE_RDV" | "DEMANDE_PRIX" | "DEMANDE_INFO" | "PAS_INTERESSE" | "A_ANALYSER" | "IGNORES";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "TOUS", label: "Tous" },
  { key: "INTERESSE", label: "Intéressés" },
  { key: "DEMANDE_RDV", label: "Rendez-vous" },
  { key: "DEMANDE_PRIX", label: "Prix" },
  { key: "DEMANDE_INFO", label: "Informations" },
  { key: "PAS_INTERESSE", label: "Pas intéressés" },
  { key: "A_ANALYSER", label: "À analyser" },
  { key: "IGNORES", label: "Ignorés" },
];

export function RepliesInbox({ conversations, ignored = [] }: { conversations: Conversation[]; ignored?: IgnoredMessage[] }) {
  const [tab, setTab] = useState<FilterTab>("TOUS");
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);

  const filteredConversations = useMemo(() => {
    if (tab === "TOUS" || tab === "IGNORES") return conversations;
    return conversations.filter((c) => {
      const lastInbound = [...c.messages].reverse().find((m) => m.direction === "INBOUND");
      return lastInbound?.classification === tab;
    });
  }, [conversations, tab]);

  const selected = filteredConversations.find((c) => c.id === selectedId) ?? filteredConversations[0] ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              tab === t.key ? "bg-brand text-white border-brand" : "bg-background hover:bg-secondary/60"
            )}
          >
            {t.label}
            {t.key === "IGNORES" && ignored.length > 0 && <span className="ml-1 opacity-70">({ignored.length})</span>}
          </button>
        ))}
      </div>

      {tab === "IGNORES" ? (
        <IgnoredView items={ignored} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-14rem)]">
          <Card className="overflow-hidden">
            <ScrollArea className="h-full">
              <div className="divide-y">
                {filteredConversations.map((c) => {
                  const last = c.messages[c.messages.length - 1];
                  const lastInbound = [...c.messages].reverse().find((m) => m.direction === "INBOUND");
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex gap-3 hover:bg-secondary/40 transition-colors",
                        selected?.id === c.id && "bg-secondary/60"
                      )}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-brand/10 text-brand text-xs">{initials(c.firstName, c.lastName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{c.firstName} {c.lastName}</p>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {last ? new Date(last.sentAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : ""}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.company ?? "—"}</p>
                        {last?.snippet && <p className="text-xs text-muted-foreground truncate mt-0.5">{last.snippet}</p>}
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {lastInbound?.messageType && (
                            <Badge variant="outline" className="text-[10px]">
                              {MESSAGE_TYPE_LABELS[lastInbound.messageType as MessageType] ?? lastInbound.messageType}
                            </Badge>
                          )}
                          {lastInbound?.classification && (
                            <Badge variant={CLASSIFICATION_VARIANT[lastInbound.classification] ?? "secondary"} className="text-[10px]">
                              {CLASSIFICATION_LABELS[lastInbound.classification as ReplyClassification] ?? lastInbound.classification}
                            </Badge>
                          )}
                          {lastInbound && lastInbound.importanceScore >= 90 && (
                            <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredConversations.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucune conversation dans ce filtre.</p>
                )}
              </div>
            </ScrollArea>
          </Card>

          <Card className="overflow-hidden flex flex-col">
            {selected ? (
              <>
                <div className="border-b p-4 flex items-center justify-between shrink-0">
                  <div>
                    <p className="font-semibold">{selected.firstName} {selected.lastName}</p>
                    <p className="text-xs text-muted-foreground">{selected.company ?? "—"} · Campagne : {selected.campaign ?? "—"}</p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/prospects/${selected.prospectId}`}><ExternalLink className="mr-1.5" size={13} /> Fiche complète</Link>
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selected.messages.map((m) => (
                      <div key={m.id} className="space-y-2">
                        <div className={cn("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                          <div className={cn("max-w-[85%] rounded-lg border p-3 text-sm", m.direction === "OUTBOUND" ? "bg-brand/5" : "bg-secondary/40")}>
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <p className="font-medium text-xs">{m.subject}</p>
                              <span className="text-[11px] text-muted-foreground shrink-0">{new Date(m.sentAt).toLocaleString("fr-FR")}</span>
                            </div>
                            {m.bodyHtml ? (
                              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
                            ) : (
                              <p className="text-muted-foreground">{m.snippet}</p>
                            )}
                            {(m.classification || m.messageType) && (
                              <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                                {m.messageType && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {MESSAGE_TYPE_LABELS[m.messageType as MessageType] ?? m.messageType}
                                  </Badge>
                                )}
                                {m.classification && (
                                  <Badge variant={CLASSIFICATION_VARIANT[m.classification] ?? "secondary"} className="text-[10px]">
                                    {CLASSIFICATION_LABELS[m.classification as ReplyClassification] ?? m.classification} · priorité {m.priority}
                                  </Badge>
                                )}
                                {m.messageType && (
                                  <Badge variant="outline" className="text-[10px]">Score {m.importanceScore}/100</Badge>
                                )}
                              </div>
                            )}
                            {m.filterReason && <p className="text-[10px] text-muted-foreground mt-1.5 italic">{m.filterReason}</p>}
                          </div>
                        </div>
                        {m.direction === "INBOUND" && m.draftStatus === "PENDING" && m.draftReply && (
                          <DraftReplyPanel
                            messageId={m.id}
                            draftReply={m.draftReply}
                            draftSource={m.draftSource}
                            draftNeedsInfo={m.draftNeedsInfo}
                          />
                        )}
                        {m.direction === "INBOUND" && m.draftStatus === "ACCEPTED" && (
                          <p className="text-[11px] text-success ml-1">Réponse acceptée — en attente de validation finale dans « À valider ».</p>
                        )}
                        {m.direction === "INBOUND" && m.draftStatus === "DISMISSED" && (
                          <p className="text-[11px] text-muted-foreground ml-1">Proposition rejetée.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="border-t p-3 flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground mr-1">Qualifier :</span>
                  <ClassifySelect prospectId={selected.prospectId} current={selected.status} />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Sélectionnez une conversation</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function IgnoredView({ items }: { items: IgnoredMessage[] }) {
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <ArchiveX className="mx-auto mb-2 opacity-40" size={22} />
        Rien n&apos;a été filtré pour le moment.
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="divide-y max-h-[calc(100vh-16rem)] overflow-y-auto">
        {items.map((m) => (
          <div key={m.id} className="px-4 py-3 text-sm flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{m.fromName || m.fromEmail}</p>
              <p className="text-xs text-muted-foreground truncate">{m.fromEmail} · {m.subject}</p>
              {m.filterReason && <p className="text-[11px] text-muted-foreground italic mt-0.5">{m.filterReason}</p>}
            </div>
            <div className="text-right shrink-0">
              <Badge variant="outline" className="text-[10px]">{MESSAGE_TYPE_LABELS[m.messageType as MessageType] ?? m.messageType}</Badge>
              <p className="text-[11px] text-muted-foreground mt-1">{new Date(m.sentAt).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="px-4 py-3 text-[11px] text-muted-foreground border-t">
        Ces emails ne sont jamais modifiés ni supprimés dans Gmail — ils sont uniquement masqués de l&apos;inbox commerciale.
      </p>
    </Card>
  );
}
