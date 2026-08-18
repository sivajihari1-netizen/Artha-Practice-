import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTION_LABELS: Record<string, string> = {
  "credential.reveal": "Revealed a credential",
  "client.delete": "Deleted a client",
  "staff.role_change": "Changed a staff member's role/status",
  "invoice.create": "Created an invoice",
  "invoice.status_change": "Changed an invoice's status",
  "invoice.email_sent": "Emailed an invoice to a client",
  "invoice.whatsapp_sent": "Shared an invoice via WhatsApp",
  "invoice.payment_received_online": "Received an online payment for an invoice",
  "quotation.create": "Created a quotation",
  "quotation.status_change": "Changed a quotation's status",
  "quotation.email_sent": "Emailed a quotation to a client",
  "quotation.whatsapp_sent": "Shared a quotation via WhatsApp",
  "quotation.accepted": "A client accepted a quotation",
  "quotation.declined": "A client declined a quotation",
};

export default async function AuditLogPage() {
  const session = getSession();

  if (session!.role === "STAFF") {
    return (
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Audit Log</h1>
        <p className="text-sm text-gray-500">Only Partners and Managers can view the audit log.</p>
      </div>
    );
  }

  const logs = await prisma.auditLog.findMany({
    where: { firmId: session!.firmId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Audit Log</h1>
      <p className="text-sm text-gray-500 mb-6">
        A record of sensitive actions — credential reveals, client deletions, staff role changes, and invoice
        status changes. Append-only.
      </p>

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">By</th>
              <th className="px-4 py-3 font-medium">Details</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{ACTION_LABELS[l.action] ?? l.action}</td>
                <td className="px-4 py-3 text-gray-500">{l.user?.name ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 max-w-md truncate" title={l.metadata ? JSON.stringify(l.metadata) : ""}>
                  {l.metadata ? JSON.stringify(l.metadata) : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nothing logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
