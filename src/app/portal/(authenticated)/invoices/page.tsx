import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActivePortalClient } from "@/lib/clientPortalAccess";
import { generatePublicToken } from "@/lib/invoice";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-gray-500",
  SENT: "text-blue-600",
  PAID: "text-accent",
  OVERDUE: "text-red-600",
  CANCELLED: "text-gray-400",
};

export default async function PortalInvoicesPage() {
  const client = await getActivePortalClient();
  if (!client) redirect("/portal/login");

  // Drafts aren't finalized/sent yet, so clients never see them.
  const where = { clientId: client.id, status: { not: "DRAFT" as const } };
  let invoices = await prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" } });

  // Backfill public tokens for any invoice created before public sharing existed.
  const missingToken = invoices.filter((i) => !i.publicToken);
  if (missingToken.length > 0) {
    await Promise.all(
      missingToken.map((i) => prisma.invoice.update({ where: { id: i.id }, data: { publicToken: generatePublicToken() } }))
    );
    invoices = await prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" } });
  }

  const outstanding = invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((sum, i) => sum + i.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Invoices</h1>
      <p className="text-sm text-gray-500 mb-6">
        {invoices.length} invoice{invoices.length === 1 ? "" : "s"} for {client.name}
        {outstanding > 0 && <> · ₹{outstanding.toLocaleString("en-IN")} outstanding</>}
      </p>

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Issue Date</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(inv.issueDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-4 py-3 font-medium">₹{inv.total.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${STATUS_COLOR[inv.status]}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <a href={`/invoice/${inv.publicToken}`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent font-medium">
                    {inv.status === "SENT" || inv.status === "OVERDUE" ? "View & Pay" : "View"}
                  </a>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
