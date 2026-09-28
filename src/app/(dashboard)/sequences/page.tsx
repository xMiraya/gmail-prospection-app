import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { createSequence } from "@/lib/actions/sequences";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { GitBranch, Plus } from "lucide-react";

export default async function SequencesPage() {
  const userId = await requireUserId();
  const sequences = await prisma.sequence.findMany({
    where: { userId },
    include: { steps: true, campaigns: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Séquences</h1>
        <p className="text-muted-foreground text-sm mt-1">Email initial + relances automatiques, réutilisables dans vos campagnes.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Créer une séquence</CardTitle></CardHeader>
        <CardContent>
          <form action={createSequence} className="flex gap-2">
            <Input name="name" placeholder="Nom de la séquence" required />
            <Input name="description" placeholder="Description (optionnel)" />
            <Button type="submit"><Plus className="mr-1.5" /> Créer</Button>
          </form>
        </CardContent>
      </Card>

      {sequences.length === 0 ? (
        <EmptyState icon={GitBranch} title="Aucune séquence" description="Créez votre première séquence ci-dessus pour pouvoir ensuite lancer une campagne." />
      ) : (
        <div className="space-y-3">
          {sequences.map((s) => (
            <Link key={s.id} href={`/sequences/${s.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.steps.length} étape(s)</p>
                  </div>
                  <Badge variant="secondary">{s.campaigns.length} campagne(s)</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
