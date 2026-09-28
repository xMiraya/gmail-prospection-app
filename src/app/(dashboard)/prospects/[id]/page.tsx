import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { updateProspectStatus, addProspectNote, optOutProspect } from "@/lib/actions/prospects";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS } from "@/components/status-badge";
import { Mail, Phone, Globe, MapPin, Send, Plus, ShieldOff } from "lucide-react";

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export default async function ProspectDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const prospect = await prisma.prospect.findFirst({
    where: { id: params.id, userId },
    include: {
      company: true,
      notes_: { orderBy: { createdAt: "desc" } },
      emailMessages: { orderBy: { sentAt: "asc" } },
      campaignProspects: { include: { campaign: true } },
    },
  });
  if (!prospect) notFound();

  const timeline = [
    { date: prospect.createdAt, label: "Prospect créé" },
    ...prospect.emailMessages.map((m) => ({
      date: m.sentAt,
      label: m.direction === "OUTBOUND" ? `Email envoyé : ${m.subject}` : `Réponse reçue : ${m.subject}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const updateStatusWithId = updateProspectStatus.bind(null, prospect.id);
  const addNoteWithId = addProspectNote.bind(null, prospect.id);
  const optOutWithId = optOutProspect.bind(null, prospect.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-brand/10 text-brand text-lg">{initials(prospect.firstName, prospect.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{prospect.firstName} {prospect.lastName}</h1>
            <p className="text-muted-foreground text-sm">{prospect.company?.name ?? "Sans entreprise"}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Mail size={13} /> {prospect.email}</span>
              {prospect.phone && <span className="flex items-center gap-1"><Phone size={13} /> {prospect.phone}</span>}
              {prospect.website && <span className="flex items-center gap-1"><Globe size={13} /> {prospect.website}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/a-valider"><Send className="mr-1.5" /> Envoyer un email</Link>
          </Button>
          <form action={async (fd: FormData) => { "use server"; await updateStatusWithId(String(fd.get("status"))); }}>
            <Select name="status" defaultValue={prospect.status}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </form>
        </div>
      </div>

      <Tabs defaultValue="activite">
        <TabsList>
          <TabsTrigger value="activite">Activité</TabsTrigger>
          <TabsTrigger value="emails">Emails</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="campagnes">Campagnes</TabsTrigger>
        </TabsList>

        <TabsContent value="activite">
          <Card>
            <CardContent className="pt-6">
              {timeline.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité pour le moment.</p>}
              <ol className="relative border-l pl-5 space-y-6">
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-brand" />
                    <p className="text-xs text-muted-foreground">
                      {t.date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    </p>
                    <p className="text-sm font-medium">{t.label}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <Card>
            <CardContent className="pt-6 space-y-3">
              {prospect.emailMessages.length === 0 && <p className="text-sm text-muted-foreground">Aucun email échangé.</p>}
              {prospect.emailMessages.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b last:border-0 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.direction === "OUTBOUND" ? "brand" : "success"}>{m.direction === "OUTBOUND" ? "Envoyé" : "Reçu"}</Badge>
                      <p className="text-sm font-medium">{m.subject}</p>
                    </div>
                    {m.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{m.snippet}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{m.sentAt.toLocaleDateString("fr-FR")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <form
                action={async (fd: FormData) => { "use server"; await addNoteWithId(String(fd.get("content"))); }}
                className="flex gap-2"
              >
                <Input name="content" placeholder="Ajouter une note..." />
                <Button type="submit" variant="outline"><Plus className="mr-1" /> Ajouter</Button>
              </form>
              <ul className="space-y-3">
                {prospect.notes_.map((n) => (
                  <li key={n.id} className="border-b last:border-0 pb-3">
                    <p className="text-sm">{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.createdAt.toLocaleString("fr-FR")}</p>
                  </li>
                ))}
                {prospect.notes_.length === 0 && <p className="text-sm text-muted-foreground">Aucune note.</p>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infos">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Téléphone</p><p>{prospect.phone ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Site web</p><p>{prospect.website ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> Ville</p><p>{prospect.city ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Secteur</p><p>{prospect.sector ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Source</p><p>{prospect.source ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Dernier contact</p><p>{prospect.lastContactAt?.toLocaleDateString("fr-FR") ?? "Jamais"}</p></div>
              <div className="col-span-2 pt-2 border-t">
                <form action={optOutWithId}>
                  <Button variant="outline" size="sm" type="submit" className="text-destructive hover:text-destructive">
                    <ShieldOff className="mr-1.5" /> Placer sur liste "Ne plus contacter" (RGPD)
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campagnes">
          <Card>
            <CardContent className="pt-6 space-y-2">
              {prospect.campaignProspects.length === 0 && <p className="text-sm text-muted-foreground">Aucune campagne associée.</p>}
              {prospect.campaignProspects.map((cp) => (
                <Link key={cp.campaignId} href={`/campagnes/${cp.campaignId}`} className="flex items-center justify-between border-b last:border-0 pb-2 hover:underline">
                  <span className="text-sm font-medium">{cp.campaign.name}</span>
                  <Badge variant="outline">Étape {cp.currentStepOrder}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
