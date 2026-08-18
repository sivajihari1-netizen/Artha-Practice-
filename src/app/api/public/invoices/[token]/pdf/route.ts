import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoicePdf";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";

/** Unauthenticated — gated only by the unguessable token, for email/WhatsApp share links. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: params.token },
    include: {
      items: true,
      client: { select: { name: true, gstin: true, pan: true } },
      firm: true,
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const paymentLinkUrl = invoice.firm.razorpayKeyId ? await ensureInvoicePaymentLink(invoice.id) : null;
  const buffer = await renderInvoicePdf({ ...invoice, paymentLinkUrl });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber.replace(/\//g, "-")}.pdf"`,
    },
  });
}
