import { requireUserId } from "@/lib/auth/session";
import { isSandboxMode } from "@/lib/gmail/client";
import { prisma } from "@/lib/db/prisma";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { FlaskConical } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const sandbox = isSandboxMode();

  const [user, account, toValidate, toRespond] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.googleAccount.findUnique({ where: { userId } }),
    prisma.scheduledEmail.count({ where: { userId, status: { in: ["A_VALIDER", "MODIFIE"] } } }),
    prisma.prospect.count({ where: { userId, status: "A_REPONDU" } }),
  ]);

  const gmail = { connected: !!account?.connected, email: account?.email };
  const counts = { toValidate, toRespond };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:border-r md:sticky md:top-0 md:h-screen">
        <AppSidebar counts={counts} user={user} gmail={gmail} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar counts={counts} user={user} gmail={gmail} />

        {sandbox && (
          <div className="flex items-center justify-center gap-2 bg-warning/15 text-warning-foreground dark:text-warning text-xs font-medium py-1.5 px-4 text-center">
            <FlaskConical size={13} />
            MODE SANDBOX — tout envoi part vers {process.env.SANDBOX_EMAIL || "(SANDBOX_EMAIL non défini)"}, jamais vers un vrai prospect
          </div>
        )}

        <div className="hidden md:flex items-center justify-end gap-2 px-6 py-2 border-b">
          {sandbox && <Badge variant="warning" className="gap-1"><FlaskConical size={11} /> Sandbox</Badge>}
          <ThemeToggle />
        </div>

        <main className="flex-1 min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
