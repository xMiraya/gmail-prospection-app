import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { updateSettings, addToBlacklist, removeFromBlacklist } from "@/lib/actions/settings";
import { isSandboxMode } from "@/lib/gmail/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Trash2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: 1, label: "Lun" }, { value: 2, label: "Mar" }, { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" }, { value: 5, label: "Ven" }, { value: 6, label: "Sam" }, { value: 0, label: "Dim" },
];

export default async function ParametresPage() {
  const userId = await requireUserId();
  const [settings, user, blacklist] = await Promise.all([
    prisma.prospectionSettings.findUnique({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.blacklist.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>

      <Tabs defaultValue="prospection">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="prospection">Prospection</TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
          <TabsTrigger value="securite">Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="profil">
          <Card>
            <CardHeader><CardTitle className="text-base">Profil</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Nom</p><p>{user.name ?? "—"}</p></div>
              <div><p className="text-muted-foreground text-xs">Email du compte</p><p>{user.email}</p></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prospection" className="space-y-4">
          <form action={updateSettings} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Automatisation</CardTitle>
                <CardDescription>Par défaut, aucune prospection ne part sans validation humaine.</CardDescription>
              </CardHeader>
              <CardContent>
                <Select name="automationMode" defaultValue={settings?.automationMode ?? "MANUEL"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUEL">Manuel — je valide chaque email et chaque relance</SelectItem>
                    <SelectItem value="SEMI_AUTOMATIQUE">Semi-automatique — relances préparées auto, à valider</SelectItem>
                    <SelectItem value="AUTOMATIQUE">Automatique — envoi selon règles, après validation globale</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Limites d'envoi &amp; horaires</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Emails maximum / jour</Label><Input name="dailyLimit" type="number" defaultValue={settings?.dailyLimit ?? 25} /></div>
                  <div className="space-y-1.5"><Label>Intervalle minimum (minutes)</Label><Input name="minIntervalMin" type="number" defaultValue={settings?.minIntervalMin ?? 3} /></div>
                  <div className="space-y-1.5"><Label>Heure de début</Label><Input name="sendStartHour" type="number" min={0} max={23} defaultValue={settings?.sendStartHour ?? 9} /></div>
                  <div className="space-y-1.5"><Label>Heure de fin</Label><Input name="sendEndHour" type="number" min={0} max={23} defaultValue={settings?.sendEndHour ?? 17} /></div>
                  <div className="space-y-1.5"><Label>Relances maximum</Label><Input name="maxFollowUps" type="number" defaultValue={settings?.maxFollowUps ?? 3} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Jours d'envoi</Label>
                  <div className="flex gap-1.5">
                    {DAYS.map((d) => (
                      <label key={d.value} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" name="sendDays" value={d.value} defaultChecked={(settings?.sendDays ?? [1, 2, 3, 4, 5]).includes(d.value)} className="accent-current" />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <input type="hidden" name="signatureHtml" value={user.signatureHtml ?? ""} />
            <Button type="submit">Enregistrer</Button>
          </form>
        </TabsContent>

        <TabsContent value="signature">
          <Card>
            <CardHeader><CardTitle className="text-base">Signature</CardTitle></CardHeader>
            <CardContent>
              <form action={updateSettings} className="space-y-3">
                <input type="hidden" name="dailyLimit" value={settings?.dailyLimit ?? 25} />
                <input type="hidden" name="sendStartHour" value={settings?.sendStartHour ?? 9} />
                <input type="hidden" name="sendEndHour" value={settings?.sendEndHour ?? 17} />
                <input type="hidden" name="minIntervalMin" value={settings?.minIntervalMin ?? 3} />
                <input type="hidden" name="maxFollowUps" value={settings?.maxFollowUps ?? 3} />
                <input type="hidden" name="automationMode" value={settings?.automationMode ?? "MANUEL"} />
                {(settings?.sendDays ?? [1, 2, 3, 4, 5]).map((d) => <input key={d} type="hidden" name="sendDays" value={d} />)}
                <Textarea name="signatureHtml" defaultValue={user.signatureHtml ?? ""} rows={5} />
                <Button type="submit">Enregistrer la signature</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist">
          <Card>
            <CardHeader><CardTitle className="text-base">Blacklist</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form action={addToBlacklist} className="flex gap-2">
                <Input name="email" placeholder="email@exemple.fr" />
                <Input name="domain" placeholder="ou domaine.fr" />
                <Input name="reason" placeholder="Raison" />
                <Button type="submit" variant="outline">Ajouter</Button>
              </form>
              <ul className="text-sm divide-y">
                {blacklist.map((b) => (
                  <li key={b.id} className="py-2 flex items-center justify-between">
                    <span>{b.email ?? b.domain} — <span className="text-muted-foreground">{b.reason}</span></span>
                    <form action={async () => { "use server"; await removeFromBlacklist(b.id); }}>
                      <Button variant="ghost" size="icon" type="submit" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </form>
                  </li>
                ))}
                {blacklist.length === 0 && <p className="text-muted-foreground text-sm py-2">Liste vide.</p>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="securite">
          <Card>
            <CardHeader><CardTitle className="text-base">Mode sandbox</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {isSandboxMode() ? (
                  <Badge variant="warning" className="gap-1"><FlaskConical size={11} /> Actif</Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><ShieldAlert size={11} /> Inactif — envois réels</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isSandboxMode()
                  ? `Tous les envois sont actuellement redirigés vers ${process.env.SANDBOX_EMAIL || "(non défini)"}. Aucun email ne part vers un vrai prospect.`
                  : "Le mode sandbox est désactivé : les emails validés partent réellement. Ne désactivez ce mode qu'une fois vos tests terminés."}
              </p>
              <p className="text-xs text-muted-foreground">
                Se configure via la variable d'environnement <code className={cn("px-1 rounded bg-secondary")}>EMAIL_SANDBOX_MODE</code> (redémarrage requis).
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
