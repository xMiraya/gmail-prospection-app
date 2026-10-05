-- Make EmailMessage.prospectId optional: filtered messages (newsletters, promos,
-- notifications) are never attached to a real or fake prospect.
ALTER TABLE "EmailMessage" DROP CONSTRAINT "EmailMessage_prospectId_fkey";
ALTER TABLE "EmailMessage" ALTER COLUMN "prospectId" DROP NOT NULL;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop the mandatory FK to EmailThread: a filtered message is never given a thread.
ALTER TABLE "EmailMessage" DROP CONSTRAINT "EmailMessage_gmailThreadId_fkey";

-- Sender info (needed since prospectId can now be null), pre-import message-type
-- filter, richer commercial classification, and draft metadata.
ALTER TABLE "EmailMessage" ADD COLUMN "fromEmail" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "fromName" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "messageType" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "filterReason" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 99;
ALTER TABLE "EmailMessage" ADD COLUMN "draftSource" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "draftNeedsInfo" BOOLEAN NOT NULL DEFAULT false;
