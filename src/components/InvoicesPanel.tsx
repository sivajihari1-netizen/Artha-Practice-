import Link from "next/link";

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
  issueDate: Date | string;
  dueDate: Date | string | null;
  total: number;
};

const STATUS_COLOR: Record<Invoice["status"], string> = {
  DRAFT: "text-gray-500 bg-gray-100",
  SENT: "text-blue-700 bg-blue-50",
  PAID: "text-green-700 bg-green-50",
  OVERDUE: "text-red-700 bg-red-50",
  CANCELLED: "text-gray-400 bg-gray-50",
};

/** Read-only — invoices are created from the Invoices module, not from here (see P0.1: relationship before duplication). */
export default function InvoicesPanel({ invoices, totalCount }: { invoices: Invoice[]; totalCount: number }) {
  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Invoices</h3>
        {totalCount > invoices.length && <span className="text-xs text-gray-400">{invoices.length} of {totalCount}</span>}
      </div>
      {invoices.length === 0 ? (
        <p className="text-xs text-gray-400">No invoices raised for this client yet.</p>
      ) : (
        <ul className="space-y-1">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/dashboard/invoices/${inv.id}`}
                className="flex items-center justify-between gap-2 text-sm hover:bg-paper-dim -mx-2 px-2 py-1.5 rounded-md"
              >
                <div>
                  <div className="font-medium text-accent">{inv.invoiceNumber}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(inv.issueDate).toLocaleDateString("en-IN")}
                    {inv.dueDate ? ` · due ${new Date(inv.dueDate).toLocaleDateString("en-IN")}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">₹{inv.total.toLocaleString("en-IN")}</div>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[inv.status]}`}>{inv.status}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
