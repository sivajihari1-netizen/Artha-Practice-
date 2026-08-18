import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { buildUpiLink } from "@/lib/invoice";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";
import InvoiceDocument from "@/components/InvoiceDocument";
import PrintButton from "@/components/PrintButton";

export default async function PublicInvoicePage({ params }: { params: { token: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: params.token },
    include: {
      items: true,
      client: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      firm: true,
    },
  });
  if (!invoice) notFound();

  const qrDataUrl = invoice.firm.upiId
    ? await QRCode.toDataURL(
        buildUpiLink({ upiId: invoice.firm.upiId, payeeName: invoice.firm.name, amount: invoice.total, note: invoice.invoiceNumber }),
        { margin: 1, width: 200 }
      )
    : null;

  const contact = invoice.client.contacts[0];
  const paymentLinkUrl = invoice.firm.razorpayKeyId ? await ensureInvoicePaymentLink(invoice.id) : null;

  return (
    <div className="min-h-screen bg-paper py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="text-lg font-extrabold text-inv-accent">
          Artha<span className="text-inv-primary">.</span>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/public/invoices/${params.token}/pdf`}
            className="border border-inv-border rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-inv-secondary"
          >
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <InvoiceDocument
        invoice={{
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
          discountType: invoice.discountType,
          discountValue: invoice.discountValue,
          discountAmount: invoice.discountAmount,
          applyGst: invoice.applyGst,
          gstType: invoice.gstType,
          gstRate: invoice.gstRate,
          subtotal: invoice.subtotal,
          taxAmount: invoice.taxAmount,
          total: invoice.total,
          paidAt: invoice.paidAt,
          paymentRef: invoice.paymentRef,
          firm: invoice.firm,
          client: { name: invoice.client.name, gstin: invoice.client.gstin, pan: invoice.client.pan, contactEmail: contact?.email, contactPhone: contact?.phone },
          items: invoice.items,
          qrDataUrl,
          paymentLinkUrl,
        }}
      />
    </div>
  );
}
