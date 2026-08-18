import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can generate payment links" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    select: { id: true, status: true, firm: { select: { razorpayKeyId: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!invoice.firm.razorpayKeyId) {
    return NextResponse.json({ error: "Connect a Razorpay account in Firm Settings first" }, { status: 400 });
  }
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED" || invoice.status === "PAID") {
    return NextResponse.json({ error: `Cannot generate a payment link for a ${invoice.status.toLowerCase()} invoice` }, { status: 400 });
  }

  const url = await ensureInvoicePaymentLink(invoice.id);
  if (!url) return NextResponse.json({ error: "Failed to generate payment link" }, { status: 502 });

  return NextResponse.json({ url });
}
