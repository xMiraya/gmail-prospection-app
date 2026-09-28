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
  AtSign,
  CheckSquare,
  Kanban,
} from "lucide-react";
import clsx from "clsx";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/a-valider", label: "À valider", icon: CheckSquare },
  { href: "/a-traiter", label: "À traiter", icon: MessageSquare },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/campagnes", label: "Campagnes", icon: Megaphone },
  { href: "/sequences", label: "Séquences", icon: GitBranch },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/reponses", label: "Réponses", icon: MessageSquare },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/statistiques", label: "Statistiques", icon: BarChart3 },
  { href: "/parametres", label: "Paramètres", icon: Settings },
  { href: "/parametres/gmail", label: "Compte Gmail", icon: AtSign },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r bg-card flex flex-col">
      <div className="px-5 py-5 border-b">
        <span className="font-semibold text-lg">Prospection</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
