-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('executed', 'pending_review', 'rejected');

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "inputContext" JSONB NOT NULL,
    "proposedAction" TEXT NOT NULL,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'pending_review',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentAction_firmId_status_idx" ON "AgentAction"("firmId", "status");

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
