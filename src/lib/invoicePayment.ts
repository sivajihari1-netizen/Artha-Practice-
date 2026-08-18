import { prisma } from "@/lib/prisma";
import { getFirmRazorpayCreds, createInvoicePaymentLink } from "@/lib/razorpayInvoicePayments";

/**
 * Lazily creates (or returns the existing) Razorpay Payment Link for an
 * invoice, using the firm's own connected Razorpay account. Returns null if
 * the firm hasn't connected Razorpay, or the invoice shouldn't have a link
 * (draft/cancelled/already paid).
 */
export async function ensureInvoicePaymentLink(invoiceId: string): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      firm: { select: { razorpayKeyId: true, razorpayKeySecretEnc: true } },
      client: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 1 } } },
    },
  });
  if (!invoice) return null;
  if (invoice.razorpayPaymentLinkUrl) return invoice.razorpayPaymentLinkUrl;
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED" || invoice.status === "PAID") return null;

  const creds = getFirmRazorpayCreds(invoice.firm);
  if (!creds) return null;

  const contact = invoice.client.contacts[0];
  try {
    const link = await createInvoicePaymentLink({
      creds,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amountInPaise: Math.round(invoice.total * 100),
      customerName: invoice.client.name,
      customerEmail: contact?.email,
      customerPhone: contact?.phone,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { razorpayPaymentLinkId: link.id, razorpayPaymentLinkUrl: link.shortUrl },
    });

    return link.shortUrl;
  } catch (err) {
    // A misconfigured/invalid Razorpay account (bad keys, account restrictions,
    // etc.) should never break invoice viewing or sending — just skip the
    // Pay Now link for this invoice. The firm can check Settings for status.
    console.error(`[invoicePayment] failed to create payment link for invoice ${invoice.id}`, err);
    return null;
  }
}
