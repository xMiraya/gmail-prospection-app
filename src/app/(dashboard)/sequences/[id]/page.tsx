import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { addSequenceStep, removeSequenceStep } from "@/lib/actions/sequences";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, ArrowDown, Clock, Trash2 } from "lucide-react";

export default async function SequenceDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const sequence = await prisma.sequence.findFirst({
    where: { id: params.id, userId },
    include: { steps: { include: { template: true }, orderBy: { order: "asc" } } },
  });
  if (!sequence) notFound();

  const templates = await prisma.emailTemplate.findMany({ where: { userId } });
  const addStep = addSequenceStep.bind(null, sequence.id);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sequence.name}</h1>

      <div className="flex flex-col items-center">
        {sequence.steps.map((step, i) => (
          <div key={step.id} className="w-full flex flex-col items-center">
            {i > 0 && (
              <div className="flex flex-col items-center py-2 text-muted-foreground text-xs">
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1 my-1">
                  <Clock size={11} /> Attendre {step.delayDays} jour{step.delayDays > 1 ? "s" : ""}
                </div>
                <div className="h-4 w-px bg-border" />
                <ArrowDown size={12} />
              </div>
            )}
            <Card className="w-full">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <Mail size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{i === 0 ? "Email initial (J0)" : `Relance ${i}`}</p>
                      <Badge variant="outline">{step.approxHour}h</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.template.name}</p>
                  </div>
                </div>
                <form action={async () => { "use server"; await removeSequenceStep(sequence.id, step.id); }}>
                  <Button variant="ghost" size="icon" type="submit" className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={15} />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ))}

        {sequence.steps.length === 0 && (
          <p className="text-sm text-muted-foreground py-6">Aucune étape. Ajoutez l'email initial ci-dessous.</p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Ajouter une étape</CardTitle></CardHeader>
        <CardContent>
          <form action={addStep} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select name="templateId" required defaultValue={templates[0]?.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Délai (jours après l'étape précédente)</Label>
                <Input name="delayDays" type="number" min={0} defaultValue={sequence.steps.length === 0 ? 0 : 3} />
              </div>
              <div className="space-y-1.5">
                <Label>Heure approximative</Label>
                <Input name="approxHour" type="number" min={0} max={23} defaultValue={9} />
              </div>
            </div>
            <Button type="submit">Ajouter l'étape</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
