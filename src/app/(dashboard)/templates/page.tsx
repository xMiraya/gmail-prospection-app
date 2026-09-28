import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { duplicateTemplate, deleteTemplate } from "@/lib/actions/templates";
import Link from "next/link";

export default async function TemplatesPage() {
  const userId = await requireUserId();
  const templates = await prisma.emailTemplate.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">Modèles réutilisables pour vos campagnes et relances.</p>
        </div>
        <Link href="/templates/new" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
          Nouveau template
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{t.name}</p>
                {t.category && <span className="badge bg-accent text-primary">{t.category}</span>}
              </div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">Objet : {t.subject}</p>
            <div className="flex flex-wrap gap-1">
              {t.variables.map((v) => (
                <span key={v} className="text-xs bg-muted rounded px-1.5 py-0.5">{`{{${v}}}`}</span>
              ))}
            </div>
            <div className="flex gap-2 pt-2 text-sm">
              <Link href={`/templates/${t.id}`} className="text-primary hover:underline">Modifier</Link>
              <form action={async () => { "use server"; await duplicateTemplate(t.id); }}>
                <button className="text-muted-foreground hover:underline" type="submit">Dupliquer</button>
              </form>
              <form action={async () => { "use server"; await deleteTemplate(t.id); }}>
                <button className="text-red-600 hover:underline" type="submit">Supprimer</button>
              </form>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">
            Aucun template. Créez-en un pour préparer vos campagnes.
          </p>
        )}
      </div>
    </div>
  );
}
