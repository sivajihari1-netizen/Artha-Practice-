-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "razorpayKeyId" TEXT,
ADD COLUMN     "razorpayKeySecretEnc" TEXT,
ADD COLUMN     "razorpayWebhookSecretEnc" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "razorpayPaymentLinkId" TEXT,
ADD COLUMN     "razorpayPaymentLinkUrl" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "lastReminderSentAt" TIMESTAMP(3);

