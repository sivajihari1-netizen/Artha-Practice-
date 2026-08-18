import Link from "next/link";
import { QuotationStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QUOTATION_SERVICE_TYPE_LABELS } from "@/lib/quotationPresets";
import ListFilterBar from "@/components/ListFilterBar";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "text-gray-500",
  SENT: "text-blue-600",
  ACCEPTED: "text-accent",
  DECLINED: "text-red-600",
  EXPIRED: "text-gray-400",
};

const QUOTATION_STATUSES = Object.values(QuotationStatus);

export default async function QuotationsPage({ searchParams }: { searchParams: { status?: string; clientId?: string } }) {
  const session = getSession();
  const firmId = session!.firmId;

  const status = searchParams.status && (QUOTATION_STATUSES as string[]).includes(searchParams.status)
    ? (searchParams.status as QuotationStatus)
    : undefined;
  const clientId = searchParams.clientId || undefined;
  const hasFilters = !!status || !!clientId;

  // Same structural guarantee as the invoice list: clientId is ANDed with
  // firmId, and a Quotation's clientId (when set at all — it's nullable for
  // prospect-only quotations) always belongs to the same firm, enforced at
  // creation in POST /api/quotations. A cross-firm id simply matches nothing.
  const [quotations, clients] = await Promise.all([
    prisma.quotation.findMany({
      where: { firmId, ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({ where: { firmId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-extrabold">Quotations</h1>
        <Link href="/dashboard/quotations/new" className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold">
          + New Quotation
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">{quotations.length} quotation{quotations.length === 1 ? "" : "s"}</p>

      <ListFilterBar statusOptions={QUOTATION_STATUSES} clients={clients} />

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Client / Prospect</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Issue Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q) => (
              <tr key={q.id} className="border-t border-line hover:bg-paper-dim">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/quotations/${q.id}`} className="font-medium text-accent">{q.quotationNumber}</Link>
                </td>
                <td className="px-4 py-3">{q.client?.name ?? q.prospectName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{QUOTATION_SERVICE_TYPE_LABELS[q.serviceType as keyof typeof QUOTATION_SERVICE_TYPE_LABELS] ?? q.serviceType}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(q.issueDate).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${STATUS_COLOR[q.status]}`}>{q.status}</span>
                </td>
              </tr>
            ))}
            {quotations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {hasFilters ? "No quotations match the selected filters." : "No quotations yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
