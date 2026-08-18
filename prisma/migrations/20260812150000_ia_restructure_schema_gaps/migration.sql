-- Decision 2 of the information-architecture restructure: fix three schema
-- gaps the nav restructure surfaced, as their own commit, separate from any
-- nav/UI change.

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('Client', 'User', 'Invoice', 'Quotation', 'Document', 'Credential', 'ReconciliationRun', 'ReconciliationMatch');

-- AlterTable: Lead -> Client (lead conversion, previously untracked)
ALTER TABLE "Lead" ADD COLUMN     "convertedClientId" TEXT;

-- AlterTable: NotificationLog -> Client / Task (previously a dead-end string)
ALTER TABLE "NotificationLog" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "sourceTaskId" TEXT;

-- AlterTable: AuditLog typed target-type sibling
ALTER TABLE "AuditLog" ADD COLUMN     "targetEntityType" "AuditTargetType";

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
