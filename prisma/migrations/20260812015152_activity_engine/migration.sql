-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('CLIENT', 'STAFF', 'TASK', 'LEAD', 'DOCUMENT', 'INVOICE', 'QUOTATION', 'RECONCILIATION', 'FIRM');

-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('USER', 'SYSTEM', 'AI');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorType" "ActivityActorType" NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_firmId_entityType_entityId_createdAt_idx" ON "Activity"("firmId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_firmId_createdAt_idx" ON "Activity"("firmId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_eventType_createdAt_idx" ON "Activity"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
