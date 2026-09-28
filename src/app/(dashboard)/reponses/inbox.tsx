"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassifySelect } from "./classify-select";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type Conversation = {
  id: string;
  prospectId: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  campaign: string | null;
  status: string;
  messages: { id: string; direction: string; subject: string; bodyHtml: string | null; snippet: string | null; sentAt: string }[];
};

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export function RepliesInbox({ conversations }: { conversations: Conversation[] }) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? null);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-11rem)]">
      <Card className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="divide-y">
            {conversations.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex gap-3 hover:bg-secondary/40 transition-colors",
                    selectedId === c.id && "bg-secondary/60"
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
                  </div>
                </button>
              );
            })}
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
                  <div key={m.id} className={cn("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-lg border p-3 text-sm", m.direction === "OUTBOUND" ? "bg-brand/5" : "bg-secondary/40")}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="font-medium text-xs">{m.subject}</p>
                        <span className="text-[11px] text-muted-foreground shrink-0">{new Date(m.sentAt).toLocaleString("fr-FR")}</span>
                      </div>
                      {m.bodyHtml ? (
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
                      ) : (
                        <p className="text-muted-foreground">{m.snippet}</p>
                      )}
                    </div>
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
  );
}
