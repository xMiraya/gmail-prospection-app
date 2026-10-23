-- CreateEnum
CREATE TYPE "InboundCategory" AS ENUM ('REAL_REPLY', 'AUTO_REPLY', 'AD_NEWSLETTER');

-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN "category" "InboundCategory";
