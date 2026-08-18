-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentSourceChannel" AS ENUM ('STAFF_MANUAL_UPLOAD', 'WHATSAPP_LINK');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "checksumSha256" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "retentionExpiryDate" TIMESTAMP(3),
ADD COLUMN     "sourceChannel" "DocumentSourceChannel" NOT NULL DEFAULT 'STAFF_MANUAL_UPLOAD',
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_supersededById_key" ON "Document"("supersededById");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

