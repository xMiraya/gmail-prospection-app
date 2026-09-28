import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Mails, Sparkles } from "lucide-react";

export default async function OnboardingPage() {
  const userId = await requireUserId();

  const [account, settings, user, prospectCount, templateCount] = await Promise.all([
    prisma.googleAccount.findUnique({ where: { userId } }),
    prisma.prospectionSettings.findUnique({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.prospect.count({ where: { userId } }),
    prisma.emailTemplate.count({ where: { userId } }),
  ]);

  const steps = [
    { key: "account", label: "Créer mon compte", done: true, href: "/parametres", optional: false },
    { key: "gmail", label: "Connecter Gmail", done: !!account?.connected, href: "/parametres/gmail", optional: false },
    { key: "signature", label: "Configurer ma signature", done: !!user.signatureHtml, href: "/parametres?tab=signature", optional: true },
    { key: "hours", label: "Définir mes horaires d'envoi", done: !!settings, href: "/parametres", optional: true },
    { key: "limit", label: "Choisir ma limite quotidienne", done: !!settings, href: "/parametres", optional: true },
    { key: "prospects", label: "Importer mes premiers prospects", done: prospectCount > 0, href: "/prospects/import", optional: false },
    { key: "template", label: "Créer mon premier template", done: templateCount > 0, href: "/templates/new", optional: false },
    { key: "test", label: "Envoyer un email test", done: false, href: "/templates", optional: true },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="h-12 w-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto">
          {allDone ? <Sparkles size={22} /> : <Mails size={22} />}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {allDone ? "Votre application est prête ! 🎉" : "Bienvenue sur votre outil de prospection"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {allDone
            ? "Toutes les étapes essentielles sont terminées. Vous pouvez lancer votre première campagne."
            : "Quelques étapes pour être opérationnel. Les étapes marquées facultatives peuvent être passées."}
        </p>
      </div>

      <div className="space-y-2">
        <Progress value={progress} />
        <p className="text-xs text-muted-foreground text-center">{doneCount} / {steps.length} étapes terminées</p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3">
              {s.done ? <CheckCircle2 className="text-success shrink-0" size={18} /> : <Circle className="text-muted-foreground shrink-0" size={18} />}
              <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
              <span className={`flex-1 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.label}</span>
              {s.optional && !s.done && <Badge variant="outline" className="text-[10px]">Facultatif</Badge>}
              {!s.done && (
                <Button asChild size="sm" variant="outline">
                  <Link href={s.href}>{s.optional ? "Configurer" : "Continuer"}</Link>
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-2">
        <Button asChild variant="ghost"><Link href="/dashboard">Passer pour l'instant</Link></Button>
        {allDone && <Button asChild><Link href="/campagnes/new">Créer ma première campagne</Link></Button>}
      </div>
    </div>
  );
}
