"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  GitBranch,
  Mail,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  CheckSquare,
  Kanban,
  Mailbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/a-valider", label: "À valider", icon: CheckSquare, key: "toValidate" },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/campagnes", label: "Campagnes", icon: Megaphone },
  { href: "/sequences", label: "Séquences", icon: GitBranch },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/reponses", label: "Réponses", icon: Mailbox, key: "toRespond" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/a-traiter", label: "À traiter", icon: MessageSquare },
];

export function SidebarNav({ counts }: { counts?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 scrollbar-thin">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        const Icon = item.icon;
        const count = item.key ? counts?.[item.key] : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{item.label}</span>
            {!!count && (
              <Badge variant={item.key === "toValidate" ? "brand" : "secondary"} className="px-1.5 py-0 text-[10px]">
                {count}
              </Badge>
            )}
          </Link>
        );
      })}
      <Link
        href="/parametres"
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors mt-2 pt-2 border-t",
          pathname?.startsWith("/parametres")
            ? "bg-secondary text-secondary-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        )}
      >
        <Settings size={16} className="shrink-0" />
        Paramètres
      </Link>
    </nav>
  );
}
