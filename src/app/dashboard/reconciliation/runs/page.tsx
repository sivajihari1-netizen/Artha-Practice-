import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";
import RunStatusBadge from "@/components/RunStatusBadge";
import Pagination from "@/components/Pagination";
import { RECONCILIATION_TYPE_LABEL } from "@/lib/reconciliationLabels";

// Batch F2.1 — firm-wide run history, the "Runs" sibling of the Exceptions
// Queue (F1). Every column is an existing ReconciliationRun field; nothing
// invented. No filters here (not requested) — just pagination, reusing F1's
// Pagination component exactly as-is.
const PAGE_SIZE = 20;

export default async function ReconciliationRunsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = getSession();
  const firmId = session!.firmId;
  const canManageReconciliation = session!.role !== "STAFF";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const [runs, total] = await Promise.all([
    prisma.reconciliationRun.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        matchedCount: true,
        exceptionCount: true,
        errorMessage: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    prisma.reconciliationRun.count({ where: { firmId } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Reconciliation Runs</h1>
      <p className="text-sm text-gray-500 mb-4">
        Every GSTR-2B/1 vs books and bank vs books reconciliation run, across every client.
      </p>

      <ReconciliationSubNav active="runs" canManageReconciliation={canManageReconciliation} />

      {runs.length === 0 ? (
        <div className="border border-line rounded-xl bg-white p-8 text-center text-sm text-gray-400">
          No reconciliation runs yet. Start one from the Upload tab.
        </div>
      ) : (
        <div className="border border-line rounded-xl bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-paper-dim text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Matched</th>
                <th className="px-4 py-3 font-medium">Exceptions</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-line hover:bg-paper-dim">
                  <td className="px-4 py-3">{run.client.name}</td>
                  <td className="px-4 py-3 text-gray-500">{RECONCILIATION_TYPE_LABEL[run.type] ?? run.type}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(run.periodStart).toLocaleDateString("en-IN")}–{new Date(run.periodEnd).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                    {run.status === "FAILED" && run.errorMessage && (
                      <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={run.errorMessage}>
                        {run.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{run.matchedCount}</td>
                  <td className="px-4 py-3 text-gray-500">{run.exceptionCount}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(run.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/reconciliation/runs/${run.id}`} className="text-xs font-semibold text-accent">
                      View run →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination pathname="/dashboard/reconciliation/runs" searchParams={searchParams} page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
