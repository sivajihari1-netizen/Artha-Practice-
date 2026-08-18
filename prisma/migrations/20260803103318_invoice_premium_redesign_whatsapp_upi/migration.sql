-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");

