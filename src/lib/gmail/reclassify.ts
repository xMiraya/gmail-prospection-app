import type { PrismaClient } from "@prisma/client";
import { classifyMessageType, VISIBLE_MESSAGE_TYPES, MESSAGE_TYPE_BASE_SCORE } from "./message-filter";
import { classifyReply, computeImportanceScore, CLASSIFICATION_PRIORITY } from "./classify";

/**
 * Reclassifie les messages déjà importés AVANT l'ajout du filtre anti-pub
 * (messageType encore à null). Met à jour uniquement messageType/filterReason/
 * importanceScore/priority — ne touche jamais Gmail, ne supprime et ne crée
 * aucune ligne. Une fois reclassifiée NEWSLETTER/PROMOTION/..., une ancienne
 * pub (Fnac, Temu...) disparaît simplement de /reponses et /a-traiter grâce au
 * filtre VISIBLE_MESSAGE_TYPES déjà appliqué par ces pages.
 */
export async function reclassifyExistingMessages(prisma: PrismaClient) {
  const toReclassify = await prisma.emailMessage.findMany({
    where: { direction: "INBOUND", messageType: null },
  });

  let updated = 0;
  for (const m of toReclassify) {
    const { type: messageType, reason: filterReason } = classifyMessageType({
      fromEmail: m.fromEmail ?? "",
      fromName: m.fromName ?? "",
      subject: m.subject,
      snippet: m.snippet ?? "",
      hasListUnsubscribe: false,
      // Un prospect déjà rattaché en base avant le filtre est traité comme connu du CRM :
      // on ne le masque jamais à tort, seules les pubs sans aucun lien commercial le sont.
      matchedProspect: m.prospectId ? { status: "CONTACTE", hasPriorOutbound: true } : null,
    });

    const isVisible = VISIBLE_MESSAGE_TYPES.includes(messageType);
    const classification = isVisible ? classifyReply(m.subject, m.snippet ?? "") : null;

    await prisma.emailMessage.update({
      where: { id: m.id },
      data: {
        messageType,
        filterReason,
        classification: classification ?? m.classification,
        priority: classification ? CLASSIFICATION_PRIORITY[classification] : m.priority,
        importanceScore: classification
          ? computeImportanceScore(classification, MESSAGE_TYPE_BASE_SCORE[messageType])
          : MESSAGE_TYPE_BASE_SCORE[messageType],
      },
    });
    updated++;
  }

  return { scanned: toReclassify.length, updated };
}
