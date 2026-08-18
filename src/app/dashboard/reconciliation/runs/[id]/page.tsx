import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";
import RunStatusBadge from "@/components/RunStatusBadge";
import ReconciliationMatchList from "@/components/ReconciliationMatchList";
import Pagination from "@/components/Pagination";
import ReconciliationRerunButton from "@/components/ReconciliationRerunButton";
import { RECONCILIATION_TYPE_LABEL } from "@/lib/reconciliationLabels";

// Batch F2.2 — single-run detail: header (client/type/period/status),
// summary counts (all existing ReconciliationRun fields), and this run's own
// exceptions — reusing ReconciliationMatchList and Pagination from F1
// unmodified, scoped to this run instead of firm-wide. Same firm-scoped
// findFirst pattern as every other detail page in this app (Invoice,
// Quotation, Client, Task 360).
const PAGE_SIZE = 50; // matches F1's Exceptions Queue and the existing per-run exceptions API

// A run hasn't finished extracting yet — rerunning matching against rows
// that don't exist yet would be meaningless. Mirrors the exact same gate
// already enforced server-side in POST /api/reconciliation-runs/[id]/rerun.
const RERUN_BLOCKED_STATUSES = new Set(["UPLOADED", "EXTRACTING"]);

export default async function ReconciliationRunDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string };
}) {
  const session = getSession();
  const firmId = session!.firmId;
  const canManageReconciliation = session!.role !== "STAFF";

  const run = await prisma.reconciliationRun.findFirst({
    where: { id: params.id, firmId },
    include: {
      client: { select: { id: true, name: true } },
      sourceADocument: { select: { id: true, fileName: true } },
      sourceBDocument: { select: { id: true, fileName: true } },
    },
  });
  if (!run) notFound();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const exceptionsWhere = { reconciliationRunId: run.id, status: "EXCEPTION" as const };

  const [exceptions, total] = await Promise.all([
    prisma.reconciliationMatch.findMany({
      where: exceptionsWhere,
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reconciliationRun: { select: { type: true, periodStart: true, periodEnd: true, client: { select: { id: true, name: true } } } },
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.reconciliationMatch.count({ where: exceptionsWhere }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <ReconciliationSubNav active="runs" canManageReconciliation={canManageReconciliation} />

      <div className="mb-2">
        <Link href="/dashboard/reconciliation/runs" className="text-xs font-semibold text-accent">
          ← Back to Runs
        </Link>
      </div>

      <div className="border border-line rounded-xl bg-white p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h1 className="text-xl font-extrabold mb-1">{RECONCILIATION_TYPE_LABEL[run.type] ?? run.type}</h1>
            <div className="text-sm text-gray-500">
              <Link href={`/dashboard/clients/${run.client.id}`} className="text-accent font-medium">
                {run.client.name}
              </Link>
              {" · "}
              {new Date(run.periodStart).toLocaleDateString("en-IN")}–{new Date(run.periodEnd).toLocaleDateString("en-IN")}
              {" · Created "}
              {new Date(run.createdAt).toLocaleDateString("en-IN")}
            </div>
          </div>
          <RunStatusBadge status={run.status} />
        </div>

        {run.status === "FAILED" && run.errorMessage && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">
            {run.errorMessage}
          </div>
        )}

        <div className="flex items-center gap-6 text-sm mb-3">
          <div>
            <span className="text-gray-500">Matched: </span>
            <span className="font-semibold">{run.matchedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">Exceptions: </span>
            <span className="font-semibold">{run.exceptionCount}</span>
          </div>
          {run.sourceADocument && (
            <div className="text-gray-400">Source A: {run.sourceADocument.fileName}</div>
          )}
          {run.sourceBDocument && (
            <div className="text-gray-400">Source B: {run.sourceBDocument.fileName}</div>
          )}
        </div>

        {canManageReconciliation && !RERUN_BLOCKED_STATUSES.has(run.status) && <ReconciliationRerunButton runId={run.id} />}
      </div>

      <h2 className="text-sm font-bold text-gray-500 mb-2">Exceptions</h2>
      <ReconciliationMatchList
        matches={exceptions}
        emptyMessage={run.exceptionCount === 0 ? "No exceptions on this run." : "No exceptions on this run's current page."}
      />

      <Pagination
        pathname={`/dashboard/reconciliation/runs/${run.id}`}
        searchParams={searchParams}
        page={page}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
