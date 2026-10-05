-- Score d'importance 0-100 affiché dans /reponses et /a-traiter (voir
-- computeImportanceScore() dans classify.ts / MESSAGE_TYPE_BASE_SCORE dans message-filter.ts).
ALTER TABLE "EmailMessage" ADD COLUMN "importanceScore" INTEGER NOT NULL DEFAULT 50;
