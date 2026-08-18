import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyFirmWebhookSignature } from "@/lib/razorpayInvoicePayments";
import { logAudit } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";
import { ActivityEvent, recordActivity } from "@/lib/activity";

/**
 * Per-firm Razorpay webhook — each firm pastes this exact URL (with their
 * own firmId baked in) into their own Razorpay Dashboard, along with their
 * own webhook secret. The firmId in the path is what lets us look up the
 * right secret to verify against; nothing is trusted until the signature
 * check passes.
 */
export async function POST(req: NextRequest, { params }: { params: { firmId: string } }) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const firm = await prisma.firm.findUnique({
    where: { id: params.firmId },
    select: { id: true, name: true, razorpayWebhookSecretEnc: true },
  });
  if (!firm?.razorpayWebhookSecretEnc) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }
  if (!verifyFirmWebhookSignature(rawBody, signature, firm.razorpayWebhookSecretEnc)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment_link.paid") {
    const linkEntity = event.payload?.payment_link?.entity;
    const paymentEntity = event.payload?.payment?.entity;
    const invoiceId: string | undefined = linkEntity?.reference_id;

    if (invoiceId) {
      // Scoped to this firm — an attacker who somehow forged reference_id
      // still can't touch another firm's invoice (and couldn't produce a
      // valid signature without this firm's own secret anyway).
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, firmId: firm.id },
        include: { client: { select: { name: true } } },
      });
      if (invoice && invoice.status !== "PAID") {
        const paymentId = paymentEntity?.id ?? linkEntity?.id;

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID", paidAt: new Date(), paymentRef: paymentId },
        });
        await logAudit({
          firmId: firm.id,
          action: "invoice.payment_received_online",
          targetType: "Invoice",
          targetId: invoice.id,
          metadata: { invoiceNumber: invoice.invoiceNumber, paymentId },
        });

        // Placed inside the same `invoice.status !== "PAID"` guard as the
        // update above (no $transaction wraps this route today — logAudit
        // isn't transactional with the update either, so this follows the
        // same existing, non-transactional sequencing) — a redelivered
        // webhook for an already-PAID invoice never reaches this line, so a
        // duplicate delivery can never record a second activity (P0.5).
        await recordActivity({
          firmId: firm.id,
          entityType: "INVOICE",
          entityId: invoice.id,
          eventType: ActivityEvent.INVOICE_PAID,
          title: `Payment received: ${invoice.invoiceNumber}`,
          actorType: "SYSTEM",
          description: `₹${invoice.total.toLocaleString("en-IN")} received online via Razorpay.`,
          metadata: { invoiceNumber: invoice.invoiceNumber, paymentId, amount: invoice.total },
        });

        const partners = await prisma.user.findMany({
          where: { firmId: firm.id, role: "PARTNER", active: true },
          select: { email: true },
        });
        await Promise.all(
          partners.map((p) =>
            sendEmail({
              to: p.email,
              subject: `Payment received: ${invoice.invoiceNumber} — ₹${invoice.total.toLocaleString("en-IN")}`,
              body: `<p><strong>${invoice.client.name}</strong> just paid invoice <strong>${invoice.invoiceNumber}</strong> for <strong>₹${invoice.total.toLocaleString("en-IN")}</strong> online via Razorpay.</p><p>Payment ID: ${paymentId}</p>`,
              firmId: firm.id,
            })
          )
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
