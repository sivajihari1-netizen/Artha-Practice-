import { inter } from "@/lib/fonts";
import { amountToWordsInr } from "@/lib/invoice";
import { sanitizeBrandColor } from "@/lib/color";

export type InvoiceDocumentData = {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  paymentTerms: string | null;
  notes: string | null;
  discountType: string | null;
  discountValue: number;
  discountAmount: number;
  applyGst: boolean;
  gstType: string | null;
  gstRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAt: Date | null;
  paymentRef: string | null;
  firm: {
    name: string;
    address: string | null;
    city: string | null;
    gstin: string | null;
    pan: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    bankName: string | null;
    bankAccountName: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
    upiId: string | null;
    showCaTagline: boolean;
    brandColor: string;
  };
  client: {
    name: string;
    gstin: string | null;
    pan: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  };
  items: { description: string; quantity: number; rate: number; amount: number }[];
  qrDataUrl?: string | null;
  paymentLinkUrl?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-slate-50 text-inv-primary",
  PAID: "bg-green-50 text-inv-success",
  OVERDUE: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-400",
};

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firmInitials(name: string): string {
  const words = name.replace(/[^\w\s&]/g, "").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

export default function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  const { firm, client, items } = invoice;
  const hasBank = !!(firm.bankName || firm.bankAccountNo || firm.upiId);
  const contactLines = [client.contactEmail, client.contactPhone].filter(Boolean);

  return (
    <div
      style={{ "--brand-primary": sanitizeBrandColor(firm.brandColor) } as React.CSSProperties}
      className={`${inter.className} max-w-[820px] mx-auto bg-white rounded-xl border border-inv-border shadow-sm print:shadow-none print:border-0 print:rounded-none p-8 sm:p-10 print:p-0 text-inv-accent`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-6 pb-8 border-b border-inv-border">
        <div className="flex gap-3">
          <div className="w-11 h-11 rounded-lg bg-inv-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
            {firmInitials(firm.name)}
          </div>
          <div>
            <div className="font-extrabold text-lg leading-tight">{firm.name}</div>
            {firm.showCaTagline && <div className="text-xs font-medium text-inv-primary mb-2">Chartered Accountants</div>}
            <div className="text-xs text-inv-accent/60 space-y-0.5">
              {(firm.address || firm.city) && <div>{[firm.address, firm.city].filter(Boolean).join(", ")}</div>}
              {firm.phone && <div>Phone: {firm.phone}</div>}
              {firm.email && <div>Email: {firm.email}</div>}
              {firm.website && <div>{firm.website}</div>}
              {firm.gstin && <div>GSTIN: {firm.gstin}</div>}
              {firm.pan && <div>PAN: {firm.pan}</div>}
            </div>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-2xl font-extrabold tracking-tight">{invoice.applyGst ? "TAX INVOICE" : "INVOICE"}</div>
          <div className="text-sm text-inv-accent/60 mt-1">{invoice.invoiceNumber}</div>
          <div className="text-xs text-inv-accent/50 mt-3 space-y-0.5">
            <div>Issue Date: {fmtDate(invoice.issueDate)}</div>
            <div>Due Date: {fmtDate(invoice.dueDate)}</div>
          </div>
          <span className={`inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[invoice.status] ?? STATUS_STYLE.DRAFT}`}>
            {invoice.status}
          </span>
        </div>
      </div>

      {/* Bill To / Invoice Details */}
      <div className="grid sm:grid-cols-2 gap-4 my-8">
        <div className="bg-inv-secondary rounded-xl border border-inv-border p-5">
          <div className="text-[11px] font-semibold text-inv-primary uppercase tracking-wide mb-2">Bill To</div>
          <div className="font-bold">{client.name}</div>
          <div className="text-xs text-inv-accent/60 mt-1 space-y-0.5">
            {client.gstin && <div>GSTIN: {client.gstin}</div>}
            {client.pan && <div>PAN: {client.pan}</div>}
            {contactLines.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
        <div className="bg-inv-secondary rounded-xl border border-inv-border p-5">
          <div className="text-[11px] font-semibold text-inv-primary uppercase tracking-wide mb-2">Invoice Details</div>
          <div className="text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-inv-accent/60">Issue Date</span><span className="font-medium">{fmtDate(invoice.issueDate)}</span></div>
            <div className="flex justify-between"><span className="text-inv-accent/60">Due Date</span><span className="font-medium">{fmtDate(invoice.dueDate)}</span></div>
            <div className="flex justify-between"><span className="text-inv-accent/60">Payment Terms</span><span className="font-medium">{invoice.paymentTerms || "—"}</span></div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-inv-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-inv-secondary text-[11px] uppercase tracking-wide text-inv-accent/60">
            <tr>
              <th className="text-left font-semibold py-3 px-4">Description</th>
              <th className="text-right font-semibold py-3 px-4 w-16">Qty</th>
              <th className="text-right font-semibold py-3 px-4 w-28">Rate</th>
              <th className="text-right font-semibold py-3 px-4 w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t border-inv-border">
                <td className="py-4 px-4 whitespace-pre-line">{item.description}</td>
                <td className="py-4 px-4 text-right text-inv-accent/70">{item.quantity}</td>
                <td className="py-4 px-4 text-right text-inv-accent/70">{fmtInr(item.rate)}</td>
                <td className="py-4 px-4 text-right font-medium">{fmtInr(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-2">
        <div className="w-full sm:w-72 text-sm space-y-2">
          <div className="flex justify-between text-inv-accent/60"><span>Subtotal</span><span>{fmtInr(invoice.subtotal)}</span></div>
          {invoice.discountAmount > 0 && (
            <div className="flex justify-between text-inv-accent/60">
              <span>Discount{invoice.discountType === "PERCENT" ? ` (${invoice.discountValue}%)` : ""}</span>
              <span>- {fmtInr(invoice.discountAmount)}</span>
            </div>
          )}
          {invoice.applyGst && invoice.gstType === "INTER" && (
            <div className="flex justify-between text-inv-accent/60"><span>IGST ({invoice.gstRate}%)</span><span>{fmtInr(invoice.taxAmount)}</span></div>
          )}
          {invoice.applyGst && invoice.gstType !== "INTER" && (
            <>
              <div className="flex justify-between text-inv-accent/60"><span>CGST ({invoice.gstRate / 2}%)</span><span>{fmtInr(invoice.taxAmount / 2)}</span></div>
              <div className="flex justify-between text-inv-accent/60"><span>SGST ({invoice.gstRate / 2}%)</span><span>{fmtInr(invoice.taxAmount / 2)}</span></div>
            </>
          )}
          <div className="flex justify-between text-lg font-extrabold border-t border-inv-border pt-2">
            <span>Total</span><span className="text-inv-primary">{fmtInr(invoice.total)}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end mb-8">
        <div className="w-full sm:w-72 bg-inv-secondary rounded-lg px-4 py-3 text-xs text-inv-accent/60 italic">
          {amountToWordsInr(invoice.total)}
        </div>
      </div>

      {invoice.status === "PAID" && invoice.paidAt && (
        <div className="mb-8 text-xs text-inv-success font-medium">
          Paid on {fmtDate(invoice.paidAt)}{invoice.paymentRef ? ` · Ref: ${invoice.paymentRef}` : ""}
        </div>
      )}

      {invoice.paymentLinkUrl && (invoice.status === "SENT" || invoice.status === "OVERDUE") && (
        <div className="flex justify-end mb-8">
          <a
            href={invoice.paymentLinkUrl}
            target="_blank" rel="noopener noreferrer"
            className="inline-block bg-inv-primary text-white text-sm font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition print:hidden"
          >
            Pay {fmtInr(invoice.total)} Now →
          </a>
        </div>
      )}

      {/* Payment details */}
      {hasBank && (
        <div className="rounded-xl border border-inv-border p-5 mb-6 flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <div className="text-[11px] font-semibold text-inv-primary uppercase tracking-wide mb-2">Payment Details</div>
            <div className="text-sm space-y-1">
              {firm.bankAccountName && <div><span className="text-inv-accent/50">A/c Name:</span> {firm.bankAccountName}</div>}
              {firm.bankName && <div><span className="text-inv-accent/50">Bank:</span> {firm.bankName}</div>}
              {firm.bankAccountNo && <div><span className="text-inv-accent/50">A/c No:</span> {firm.bankAccountNo}</div>}
              {firm.bankIfsc && <div><span className="text-inv-accent/50">IFSC:</span> {firm.bankIfsc}</div>}
              {firm.upiId && <div><span className="text-inv-accent/50">UPI ID:</span> {firm.upiId}</div>}
            </div>
          </div>
          {invoice.qrDataUrl && (
            <div className="text-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote image */}
              <img src={invoice.qrDataUrl} alt="Scan to pay via UPI" width={112} height={112} className="rounded-md border border-inv-border" />
              <div className="text-[10px] text-inv-accent/50 mt-1">Scan to pay via UPI</div>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-inv-secondary rounded-xl p-5 text-sm text-inv-accent/70 mb-8">
        {invoice.notes || "Thank you for your business."}
      </div>

      {/* Footer */}
      <div className="pt-6 border-t border-inv-border text-center text-[11px] text-inv-accent/40 space-y-0.5">
        <div>This is a computer-generated invoice. No signature required.</div>
        {(firm.website || firm.email) && <div>{[firm.website, firm.email].filter(Boolean).join(" · ")}</div>}
      </div>
    </div>
  );
}
