import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { renderInvoicePdf } from "@/lib/invoicePdf";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: {
      items: true,
      client: { select: { name: true, gstin: true, pan: true } },
      firm: { select: { name: true, gstin: true, pan: true, address: true, city: true, phone: true, email: true, website: true, bankName: true, bankAccountName: true, bankAccountNo: true, bankIfsc: true, upiId: true, showCaTagline: true, brandColor: true, razorpayKeyId: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const paymentLinkUrl = invoice.firm.razorpayKeyId ? await ensureInvoicePaymentLink(invoice.id) : null;
  const buffer = await renderInvoicePdf({ ...invoice, paymentLinkUrl });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
