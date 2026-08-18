-- CreateEnum
CREATE TYPE "ReconciliationType" AS ENUM ('GST_2B_VS_PURCHASE', 'GST_1_VS_SALES', 'BANK_VS_BOOKS');

-- CreateEnum
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'EXTRACTED', 'MATCHING', 'MATCHED', 'REVIEWED', 'CLOSED', 'FAILED');

-- CreateEnum
CREATE TYPE "LineItemSource" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('JSON_PARSE', 'CSV_PARSE', 'EXCEL_PARSE', 'PDF_OCR');

-- CreateEnum
CREATE TYPE "ReconciliationMatchType" AS ENUM ('EXACT', 'FUZZY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReconciliationMatchStatus" AS ENUM ('MATCHED', 'EXCEPTION', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "ReconciliationExceptionReason" AS ENUM ('MISSING_IN_BOOKS', 'MISSING_IN_SOURCE', 'AMOUNT_MISMATCH', 'DATE_MISMATCH', 'GSTIN_MISMATCH', 'DUPLICATE', 'RATE_MISMATCH');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ReconciliationType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sourceADocumentId" TEXT,
    "sourceBDocumentId" TEXT,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'UPLOADED',
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedLineItem" (
    "id" TEXT NOT NULL,
    "reconciliationRunId" TEXT NOT NULL,
    "source" "LineItemSource" NOT NULL,
    "rawRow" JSONB NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "amount" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION,
    "counterparty" TEXT,
    "referenceNo" TEXT,
    "gstin" TEXT,
    "confidenceScore" INTEGER NOT NULL DEFAULT 100,
    "extractionMethod" "ExtractionMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationMatch" (
    "id" TEXT NOT NULL,
    "reconciliationRunId" TEXT NOT NULL,
    "lineItemAId" TEXT,
    "lineItemBId" TEXT,
    "matchType" "ReconciliationMatchType" NOT NULL,
    "matchConfidence" INTEGER NOT NULL,
    "status" "ReconciliationMatchStatus" NOT NULL DEFAULT 'MATCHED',
    "exceptionReason" "ReconciliationExceptionReason",
    "exceptionExplanation" TEXT,
    "materialityAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "taskId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationColumnMapping" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationRun_firmId_clientId_idx" ON "ReconciliationRun"("firmId", "clientId");

-- CreateIndex
CREATE INDEX "ExtractedLineItem_reconciliationRunId_normalizedKey_idx" ON "ExtractedLineItem"("reconciliationRunId", "normalizedKey");

-- CreateIndex
CREATE INDEX "ReconciliationMatch_reconciliationRunId_status_idx" ON "ReconciliationMatch"("reconciliationRunId", "status");

-- CreateIndex
CREATE INDEX "ReconciliationMatch_reconciliationRunId_riskScore_idx" ON "ReconciliationMatch"("reconciliationRunId", "riskScore");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationColumnMapping_clientId_sourceType_key" ON "ReconciliationColumnMapping"("clientId", "sourceType");

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_sourceADocumentId_fkey" FOREIGN KEY ("sourceADocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_sourceBDocumentId_fkey" FOREIGN KEY ("sourceBDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedLineItem" ADD CONSTRAINT "ExtractedLineItem_reconciliationRunId_fkey" FOREIGN KEY ("reconciliationRunId") REFERENCES "ReconciliationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_reconciliationRunId_fkey" FOREIGN KEY ("reconciliationRunId") REFERENCES "ReconciliationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_lineItemAId_fkey" FOREIGN KEY ("lineItemAId") REFERENCES "ExtractedLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_lineItemBId_fkey" FOREIGN KEY ("lineItemBId") REFERENCES "ExtractedLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationColumnMapping" ADD CONSTRAINT "ReconciliationColumnMapping_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
