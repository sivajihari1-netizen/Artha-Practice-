import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ListFilterBar from "@/components/ListFilterBar";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-gray-500",
  SENT: "text-blue-600",
  PAID: "text-accent",
  OVERDUE: "text-red-600",
  CANCELLED: "text-gray-400",
};

const INVOICE_STATUSES = Object.values(InvoiceStatus);

export default async function InvoicesPage({ searchParams }: { searchParams: { status?: string; clientId?: string } }) {
  const session = getSession();
  const firmId = session!.firmId;

  // Only trust a status value that's a real enum member — anything else is
  // ignored (treated as "no filter") rather than passed to Prisma, which
  // would throw on an invalid enum value.
  const status = searchParams.status && (INVOICE_STATUSES as string[]).includes(searchParams.status)
    ? (searchParams.status as InvoiceStatus)
    : undefined;
  const clientId = searchParams.clientId || undefined;
  const hasFilters = !!status || !!clientId;

  // clientId is ANDed with firmId in the same where clause below, so a
  // cross-firm id can never match a row — an Invoice's clientId always
  // belongs to the same firm as the invoice itself (enforced at creation in
  // POST /api/invoices), so this is a structural guarantee, not a filter
  // that needs a separate ownership check.
  const [invoices, clients] = await Promise.all([
    prisma.invoice.findMany({
      where: { firmId, ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ where: { firmId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const outstanding = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold">Invoices</h1>
        <Link href="/dashboard/invoices/new" className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold">
          + New Invoice
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {invoices.length} invoice{invoices.length === 1 ? "" : "s"} · ₹{outstanding.toLocaleString("en-IN")} outstanding
      </p>

      <ListFilterBar statusOptions={INVOICE_STATUSES} clients={clients} />

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Issue Date</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-line hover:bg-paper-dim cursor-pointer">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium text-accent">
                    {inv.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{inv.client.name}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(inv.issueDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-4 py-3 font-medium">₹{inv.total.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${STATUS_COLOR[inv.status]}`}>{inv.status}</span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {hasFilters ? "No invoices match the selected filters." : "No invoices yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
