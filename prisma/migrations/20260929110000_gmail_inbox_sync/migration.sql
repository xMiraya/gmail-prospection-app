-- Adds sync status tracking to GoogleAccount and reply classification/draft fields to EmailMessage
ALTER TABLE "GoogleAccount" ADD COLUMN "lastSyncNewCount" INTEGER;
ALTER TABLE "GoogleAccount" ADD COLUMN "lastSyncError" TEXT;

ALTER TABLE "EmailMessage" ADD COLUMN "classification" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "draftReply" TEXT;
ALTER TABLE "EmailMessage" ADD COLUMN "draftStatus" TEXT;
