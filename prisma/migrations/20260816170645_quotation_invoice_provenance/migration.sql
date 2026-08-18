-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "sourceQuotationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sourceQuotationId_key" ON "Invoice"("sourceQuotationId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceQuotationId_fkey" FOREIGN KEY ("sourceQuotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

