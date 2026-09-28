import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { duplicateTemplate, deleteTemplate } from "@/lib/actions/templates";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FileText, Plus, Copy, Trash2, Pencil } from "lucide-react";

export default async function TemplatesPage() {
  const userId = await requireUserId();
  const templates = await prisma.emailTemplate.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-muted-foreground text-sm mt-1">Modèles réutilisables pour vos campagnes et relances.</p>
        </div>
        <Button asChild>
          <Link href="/templates/new"><Plus className="mr-1.5" /> Nouveau template</Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun template"
          description="Créez votre premier template pour préparer vos campagnes de prospection."
          actions={<Button asChild><Link href="/templates/new">Créer un template</Link></Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="p-5 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <p className="font-semibold">{t.name}</p>
                  {t.category && <Badge variant="secondary">{t.category}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">Objet : {t.subject}</p>
                <p
                  className="text-xs text-muted-foreground line-clamp-3 flex-1"
                  dangerouslySetInnerHTML={{ __html: t.body }}
                />
                <div className="flex flex-wrap gap-1">
                  {t.variables.map((v) => (
                    <span key={v} className="text-[11px] bg-secondary rounded px-1.5 py-0.5 font-mono">{`{{${v}}}`}</span>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Modifié le {t.updatedAt.toLocaleDateString("fr-FR")}</p>
                <div className="flex gap-1 pt-2 border-t mt-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/templates/${t.id}`}><Pencil className="mr-1" size={13} /> Modifier</Link>
                  </Button>
                  <form action={async () => { "use server"; await duplicateTemplate(t.id); }}>
                    <Button variant="ghost" size="sm" type="submit"><Copy className="mr-1" size={13} /> Dupliquer</Button>
                  </form>
                  <form action={async () => { "use server"; await deleteTemplate(t.id); }}>
                    <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive"><Trash2 className="mr-1" size={13} /> Supprimer</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
