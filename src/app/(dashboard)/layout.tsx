import { Sidebar } from "@/components/sidebar";
import { requireUserId } from "@/lib/auth/session";
import { isSandboxMode } from "@/lib/gmail/client";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  const sandbox = isSandboxMode();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {sandbox && (
          <div className="bg-amber-500 text-white text-center text-xs font-semibold py-1.5 tracking-wide">
            MODE SANDBOX — aucun email n'est envoyé aux vrais prospects, tout part vers {process.env.SANDBOX_EMAIL ?? "(SANDBOX_EMAIL non défini)"}
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
