import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { generatePublicToken } from "@/lib/invoice";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";

const INCLUDE = {
  client: { include: { contacts: { where: { phone: { not: null } }, orderBy: { isPrimary: "desc" }, take: 1 } } },
  firm: { select: { name: true, razorpayKeyId: true } },
} as const;

/** Shares the invoice's public link (and payment link, if connected) with the client's primary contact over WhatsApp. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can send invoices" }, { status: 403 });
  }

  let invoice = await prisma.invoice.findFirst({ where: { id: params.id, firmId: auth.session.firmId }, include: INCLUDE });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contactPhone = invoice.client.contacts[0]?.phone;
  if (!contactPhone) {
    return NextResponse.json({ error: "No client contact with a phone number on file" }, { status: 400 });
  }

  // Transition DRAFT -> SENT before generating the payment link, since a link
  // is only ever created for a sendable (non-draft) invoice.
  if (!invoice.publicToken || invoice.status === "DRAFT") {
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        publicToken: invoice.publicToken ?? generatePublicToken(),
        status: invoice.status === "DRAFT" ? "SENT" : invoice.status,
      },
      include: INCLUDE,
    });
  }

  const link = `${process.env.APP_URL ?? "https://arthapractice.in"}/invoice/${invoice.publicToken}`;
  const paymentLinkUrl = invoice.firm.razorpayKeyId ? await ensureInvoicePaymentLink(invoice.id) : null;

  const result = await sendWhatsAppMessage({
    to: contactPhone,
    templateName: "invoice_share",
    variables: {
      client_name: invoice.client.name,
      invoice_number: invoice.invoiceNumber,
      amount: `₹${invoice.total.toLocaleString("en-IN")}`,
      link,
      ...(paymentLinkUrl ? { pay_link: paymentLinkUrl } : {}),
    },
    firmId: auth.session.firmId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 502 });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { whatsappSentAt: new Date() },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "invoice.whatsapp_sent",
    targetType: "Invoice",
    targetId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, to: contactPhone },
  });

  return NextResponse.json({ ok: true, invoice: updated, sentTo: contactPhone, link, paymentLinkUrl });
}
