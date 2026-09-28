import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { updateProspectStatus, addProspectNote, optOutProspect } from "@/lib/actions/prospects";
import { notFound } from "next/navigation";

const STATUSES = [
  "NOUVEAU", "A_CONTACTER", "EMAIL_PROGRAMME", "CONTACTE", "RELANCE_1", "RELANCE_2",
  "RELANCE_3", "A_REPONDU", "INTERESSE", "A_RAPPELER", "RENDEZ_VOUS", "PROPOSITION_ENVOYEE",
  "PAS_INTERESSE", "CLIENT", "NE_PLUS_CONTACTER", "A_VERIFIER",
];

export default async function ProspectDetailPage({ params }: { params: { id: string } }) {
  const userId = await requireUserId();
  const prospect = await prisma.prospect.findFirst({
    where: { id: params.id, userId },
    include: {
      company: true,
      notes_: { orderBy: { createdAt: "desc" } },
      emailMessages: { orderBy: { sentAt: "asc" } },
      scheduledEmails: { orderBy: { scheduledFor: "asc" } },
    },
  });
  if (!prospect) notFound();

  const timeline = [
    { date: prospect.createdAt, label: "Prospect créé" },
    ...prospect.emailMessages.map((m) => ({
      date: m.sentAt,
      label: m.direction === "OUTBOUND" ? `Email envoyé : ${m.subject}` : `Réponse reçue : ${m.subject}`,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const updateStatusWithId = updateProspectStatus.bind(null, prospect.id);
  const addNoteWithId = addProspectNote.bind(null, prospect.id);
  const optOutWithId = optOutProspect.bind(null, prospect.id);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {prospect.firstName} {prospect.lastName}
          </h1>
          <p className="text-muted-foreground text-sm">{prospect.company?.name ?? "Sans entreprise"} — {prospect.email}</p>
        </div>
        <form action={async (fd: FormData) => { "use server"; await updateStatusWithId(String(fd.get("status"))); }}>
          <select name="status" defaultValue={prospect.status} className="rounded-md border px-3 py-2 text-sm">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
            ))}
          </select>
          <button className="ml-2 rounded-md border px-3 py-2 text-sm hover:bg-muted" type="submit">
            Mettre à jour
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
          <h2 className="font-semibold mb-2">Informations</h2>
          <p><span className="text-muted-foreground">Téléphone :</span> {prospect.phone ?? "—"}</p>
          <p><span className="text-muted-foreground">Site :</span> {prospect.website ?? "—"}</p>
          <p><span className="text-muted-foreground">Ville :</span> {prospect.city ?? "—"}</p>
          <p><span className="text-muted-foreground">Secteur :</span> {prospect.sector ?? "—"}</p>
          <p><span className="text-muted-foreground">Source :</span> {prospect.source ?? "—"}</p>
          <p><span className="text-muted-foreground">Dernier contact :</span> {prospect.lastContactAt?.toLocaleDateString("fr-FR") ?? "Jamais"}</p>
          <form action={optOutWithId} className="pt-2">
            <button className="text-xs text-red-600 hover:underline" type="submit">
              Placer sur liste "Ne plus contacter" (RGPD)
            </button>
          </form>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3 text-sm">
          <h2 className="font-semibold">Timeline</h2>
          <ol className="space-y-2">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">{t.date.toLocaleDateString("fr-FR")}</span>
                <span>{t.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-sm">Notes</h2>
        <form
          action={async (fd: FormData) => { "use server"; await addNoteWithId(String(fd.get("content"))); }}
          className="flex gap-2"
        >
          <input name="content" placeholder="Ajouter une note..." className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" type="submit">Ajouter</button>
        </form>
        <ul className="space-y-2 text-sm">
          {prospect.notes_.map((n) => (
            <li key={n.id} className="border-t pt-2">
              <p>{n.content}</p>
              <p className="text-xs text-muted-foreground">{n.createdAt.toLocaleString("fr-FR")}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
