"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Mails, ChevronsUpDown, LogOut, CircleUserRound, CheckCircle2, AlertCircle } from "lucide-react";
import { SidebarNav } from "@/components/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type GmailStatus = { connected: boolean; email?: string | null };

function initials(name?: string | null, email?: string | null) {
  const source = name || email || "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function AppSidebar({
  counts,
  user,
  gmail,
}: {
  counts?: Record<string, number>;
  user: { name?: string | null; email?: string | null };
  gmail: GmailStatus;
}) {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-2 px-4 py-4 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
          <Mails size={16} />
        </div>
        <span className="font-semibold tracking-tight">Prospection</span>
      </div>

      <SidebarNav counts={counts} />

      <div className="border-t p-3 space-y-2">
        <Link
          href="/parametres/gmail"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60 transition-colors"
        >
          {gmail.connected ? (
            <CheckCircle2 size={14} className="text-success shrink-0" />
          ) : (
            <AlertCircle size={14} className="text-warning shrink-0" />
          )}
          <span className="truncate text-muted-foreground">
            {gmail.connected ? gmail.email : "Gmail non connecté"}
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60 transition-colors">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-brand/10 text-brand text-[10px]">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate text-left">{user.name || user.email}</span>
            <ChevronsUpDown size={14} className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/parametres">
                <CircleUserRound className="mr-2 h-4 w-4" /> Profil &amp; paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="mr-2 h-4 w-4" /> Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
