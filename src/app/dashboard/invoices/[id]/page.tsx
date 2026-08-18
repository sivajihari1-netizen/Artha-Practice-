import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildUpiLink, generatePublicToken } from "@/lib/invoice";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";
import InvoiceActions from "@/components/InvoiceActions";
import InvoiceDocument from "@/components/InvoiceDocument";
import PrintButton from "@/components/PrintButton";
import Breadcrumb from "@/components/Breadcrumb";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  let invoice = await prisma.invoice.findFirst({
    where: { id: params.id, firmId: session!.firmId },
    include: {
      items: true,
      client: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 1 } } },
      firm: true,
    },
  });
  if (!invoice) notFound();

  // Older invoices created before public sharing existed won't have a token yet — backfill lazily.
  if (!invoice.publicToken) {
    invoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { publicToken: generatePublicToken() },
      include: {
        items: true,
        client: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 1 } } },
        firm: true,
      },
    });
  }

  const contact = invoice.client.contacts[0];
  const qrDataUrl = invoice.firm.upiId
    ? await QRCode.toDataURL(
        buildUpiLink({ upiId: invoice.firm.upiId, payeeName: invoice.firm.name, amount: invoice.total, note: invoice.invoiceNumber }),
        { margin: 1, width: 200 }
      )
    : null;
  const shareLink = `${process.env.APP_URL ?? "https://arthapractice.in"}/invoice/${invoice.publicToken}`;
  const paymentLinkUrl = invoice.firm.razorpayKeyId ? await ensureInvoicePaymentLink(invoice.id) : null;

  return (
    <div>
      <div className="print:hidden">
        <Breadcrumb items={[{ label: "Money", href: "/dashboard/invoices" }, { label: "Invoices", href: "/dashboard/invoices" }, { label: invoice.invoiceNumber }]} />
      </div>
      <div className="print:hidden mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-gray-500">
            <Link href={`/dashboard/clients/${invoice.client.id}`} className="text-accent hover:underline">
              {invoice.client.name}
            </Link>
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="print:hidden mb-5">
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          clientEmail={contact?.email ?? null}
          clientPhone={contact?.phone ?? null}
          shareLink={shareLink}
          razorpayConnected={!!invoice.firm.razorpayKeyId}
        />
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
