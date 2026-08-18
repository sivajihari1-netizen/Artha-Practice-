import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FirmSettingsForm from "@/components/FirmSettingsForm";
import TaskWorkflowSettingsPanel from "@/components/TaskWorkflowSettingsPanel";
import { ensureFirmTaskWorkflow } from "@/lib/taskWorkflow";

export default async function SettingsPage() {
  const session = getSession();
  const firmId = session!.firmId;

  const [firm, workflow] = await Promise.all([
    prisma.firm.findUnique({
      where: { id: firmId },
      select: {
        id: true, name: true, city: true, gstin: true, pan: true, address: true,
        bankName: true, bankAccountName: true, bankAccountNo: true, bankIfsc: true, upiId: true,
        phone: true, email: true, website: true, showCaTagline: true, brandColor: true,
        razorpayKeyId: true, razorpayKeySecretEnc: true, razorpayWebhookSecretEnc: true,
      },
    }),
    ensureFirmTaskWorkflow(firmId),
  ]);
  const { razorpayKeySecretEnc, razorpayWebhookSecretEnc, ...safeFirm } = firm!;
  const webhookUrl = `${process.env.APP_URL ?? "https://arthapractice.in"}/api/webhooks/razorpay/${session!.firmId}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Firm Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Your firm&apos;s details, used on invoices and official records.</p>
        <FirmSettingsForm
          firm={{ ...safeFirm, razorpayKeySecretSet: !!razorpayKeySecretEnc, razorpayWebhookSecretSet: !!razorpayWebhookSecretEnc }}
          canEdit={session!.role === "PARTNER"}
          webhookUrl={webhookUrl}
        />
      </div>

      <TaskWorkflowSettingsPanel
        statusOptions={workflow.statusOptions}
        categoryOptions={workflow.categoryOptions}
        canEdit={session!.role !== "STAFF"}
      />
    </div>
  );
}
