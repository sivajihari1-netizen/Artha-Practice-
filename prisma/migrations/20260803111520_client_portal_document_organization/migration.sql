-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "periodMonth" INTEGER,
ADD COLUMN     "periodYear" INTEGER,
ADD COLUMN     "workType" "ReturnType";

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "showCaTagline" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ClientPortalMagicLink" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientPortalMagicLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPortalMagicLink_token_key" ON "ClientPortalMagicLink"("token");

