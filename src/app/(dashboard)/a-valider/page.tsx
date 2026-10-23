import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import { isSandboxMode } from "@/lib/gmail/client";
import { ValidationWorkspace } from "./validation-workspace";

export default async function AValiderPage() {
  const userId = await requireUserId();
  const account = await prisma.googleAccount.findUnique({ where: { userId } });

  const drafts = await prisma.scheduledEmail.findMany({
    where: { userId, status: { in: ["A_VALIDER", "MODIFIE"] } },
    include: {
      prospect: {
        include: {
          company: true,
          notes_: { orderBy: { createdAt: "desc" }, take: 5 },
          tags: { include: { tag: true } },
        },
      },
      campaign: { include: { sequence: true } },
      sequenceStep: true,
    },
    orderBy: { scheduledFor: "asc" },
  });

  // Historique rapide (derniers emails/réponses) pour chaque prospect concerné.
  const prospectIds = Array.from(new Set(drafts.map((d) => d.prospectId)));
  const history = await prisma.emailMessage.findMany({
    where: { prospectId: { in: prospectIds } },
    orderBy: { sentAt: "desc" },
  });
  const historyByProspect = new Map<string, typeof history>();
  for (const h of history) {
    if (!h.prospectId) continue;
    const list = historyByProspect.get(h.prospectId) ?? [];
    list.push(h);
    historyByProspect.set(h.prospectId, list);
  }

  return (
    <ValidationWorkspace
      drafts={drafts.map((d) => ({
        id: d.id,
        toEmail: d.toEmail,
        subject: d.subject,
        bodyHtml: d.bodyHtml,
        scheduledFor: d.scheduledFor.toISOString(),
        missingVariables: d.missingVariables,
        status: d.status,
        prospect: {
          id: d.prospect.id,
          firstName: d.prospect.firstName,
          lastName: d.prospect.lastName,
          email: d.prospect.email,
          phone: d.prospect.phone,
          city: d.prospect.city,
          sector: d.prospect.sector,
          website: d.prospect.website,
          linkedinUrl: d.prospect.linkedinUrl,
          lastContactAt: d.prospect.lastContactAt?.toISOString() ?? null,
          company: d.prospect.company ? { name: d.prospect.company.name } : null,
          notes: d.prospect.notes_.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt.toISOString() })),
          tags: d.prospect.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
        },
        campaign: d.campaign ? { id: d.campaign.id, name: d.campaign.name, sequenceName: d.campaign.sequence?.name ?? null } : null,
        sequenceStep: d.sequenceStep ? { order: d.sequenceStep.order } : null,
        history: (historyByProspect.get(d.prospectId) ?? []).slice(0, 5).map((h) => ({
          id: h.id,
          direction: h.direction,
          subject: h.subject,
          sentAt: h.sentAt.toISOString(),
        })),
      }))}
      sandbox={isSandboxMode() ? { email: process.env.SANDBOX_EMAIL ?? "" } : null}
      gmailEmail={account?.email ?? "votre adresse Gmail"}
    />
  );
}
