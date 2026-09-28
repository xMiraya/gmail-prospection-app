"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar, type GmailStatus } from "@/components/app-sidebar";

export function Topbar({
  title,
  counts,
  user,
  gmail,
}: {
  title?: string;
  counts?: Record<string, number>;
  user: { name?: string | null; email?: string | null };
  gmail: GmailStatus;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/80 backdrop-blur px-4 py-3 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar counts={counts} user={user} gmail={gmail} />
        </SheetContent>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </Sheet>
      <span className="font-semibold text-sm flex-1">{title ?? "Prospection"}</span>
      <ThemeToggle />
    </header>
  );
}
