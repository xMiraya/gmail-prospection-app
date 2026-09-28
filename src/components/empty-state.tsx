import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-dashed bg-card/50">
      <div className="h-12 w-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
        <Icon size={22} />
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2 mt-5">{actions}</div>}
    </div>
  );
}
