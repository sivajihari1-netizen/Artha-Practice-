-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "turnover" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "clientGstinId" TEXT,
ADD COLUMN     "complianceRuleId" TEXT;

-- CreateTable
CREATE TABLE "ClientGstin" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "qrmpOpted" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientGstin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "returnType" "ReturnType" NOT NULL,
    "recurrence" TEXT NOT NULL,
    "appliesToGstin" BOOLEAN NOT NULL DEFAULT false,
    "conditions" JSONB NOT NULL,
    "dueDateOffsetDays" INTEGER,
    "overrideDueDate" TIMESTAMP(3),
    "overrideAppliesToPeriod" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientGstin_clientId_gstin_key" ON "ClientGstin"("clientId", "gstin");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRule_ruleCode_key" ON "ComplianceRule"("ruleCode");

-- CreateIndex
CREATE UNIQUE INDEX "Task_complianceRuleId_clientId_periodKey_key" ON "Task"("complianceRuleId", "clientId", "periodKey");

-- AddForeignKey
ALTER TABLE "ClientGstin" ADD CONSTRAINT "ClientGstin_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_complianceRuleId_fkey" FOREIGN KEY ("complianceRuleId") REFERENCES "ComplianceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientGstinId_fkey" FOREIGN KEY ("clientGstinId") REFERENCES "ClientGstin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

