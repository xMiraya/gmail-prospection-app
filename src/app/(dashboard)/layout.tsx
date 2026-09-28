import { Sidebar } from "@/components/sidebar";
import { requireUserId } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUserId();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
