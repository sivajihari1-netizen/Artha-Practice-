import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";

// Razorpay webhook endpoint. Configure this URL (https://yourdomain.com/api/billing/webhook)
// in the Razorpay dashboard under Settings > Webhooks, subscribe to
// "payment.captured" / "order.paid", and set RAZORPAY_WEBHOOK_SECRET to the
// secret shown there. Never trust a client-side "payment succeeded"
// callback alone — this server-to-server webhook is the source of truth.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity ?? event.payload?.order?.entity;
    const receipt: string | undefined = payment?.receipt ?? event.payload?.order?.entity?.receipt;

    // Receipt format from /api/billing/checkout: firm_<firmId>_<planId>_<timestamp>
    const match = receipt?.match(/^firm_(.+?)_(.+?)_(\d+)$/);
    if (match) {
      const [, firmId, planId] = match;
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      await prisma.firm.update({ where: { id: firmId }, data: { planId } });
      await prisma.subscription.upsert({
        where: { firmId },
        update: { status: "ACTIVE", currentPeriodEnd: periodEnd },
        create: { firmId, status: "ACTIVE", currentPeriodEnd: periodEnd },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
