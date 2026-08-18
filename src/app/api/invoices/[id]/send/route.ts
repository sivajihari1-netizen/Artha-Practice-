import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { renderInvoicePdf } from "@/lib/invoicePdf";
import { sendEmail } from "@/lib/email";
import { generatePublicToken } from "@/lib/invoice";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";

const INCLUDE = {
  items: true,
  client: {
    select: {
      name: true, gstin: true, pan: true,
      contacts: { where: { email: { not: null } }, orderBy: { isPrimary: "desc" }, take: 1 },
    },
  },
  firm: true,
} as const;

/** Emails the invoice PDF to the client's primary (or first available) contact. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can send invoices" }, { status: 403 });
  }

  let invoice = await prisma.invoice.findFirst({ where: { id: params.id, firmId: auth.session.firmId }, include: INCLUDE });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contactEmail = invoice.client.contacts[0]?.email;
  if (!contactEmail) {
    return NextResponse.json({ error: "No client contact with an email address on file" }, { status: 400 });
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
  const pdfBuffer = await renderInvoicePdf({ ...invoice, paymentLinkUrl });

  const result = await sendEmail({
    to: contactEmail,
    subject: `${invoice.applyGst ? "Tax Invoice" : "Invoice"} ${invoice.invoiceNumber} from ${invoice.firm.name}`,
    body: `<p>Dear ${invoice.client.name},</p><p>Please find attached ${invoice.applyGst ? "tax invoice" : "invoice"} <strong>${invoice.invoiceNumber}</strong> for <strong>₹${invoice.total.toLocaleString("en-IN")}</strong>${invoice.dueDate ? `, due on ${new Date(invoice.dueDate).toLocaleDateString("en-IN")}` : ""}.</p>${paymentLinkUrl ? `<p><a href="${paymentLinkUrl}"><strong>Pay Now Online</strong></a></p>` : ""}<p>You can also view the full invoice here: <a href="${link}">${link}</a></p><p>Regards,<br/>${invoice.firm.name}</p>`,
    firmId: auth.session.firmId,
    attachments: [{ filename: `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { emailedAt: new Date() },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "invoice.email_sent",
    targetType: "Invoice",
    targetId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, to: contactEmail },
  });

  return NextResponse.json({ ok: true, invoice: updated, sentTo: contactEmail });
}
