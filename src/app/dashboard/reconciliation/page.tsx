import { ReconciliationExceptionReason, ReconciliationType } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReconciliationFilterBar from "@/components/ReconciliationFilterBar";
import ReconciliationMatchList from "@/components/ReconciliationMatchList";
import Pagination from "@/components/Pagination";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";

// Firm-wide reconciliation exceptions, across every run — the "Review
// Queue" counterpart to Agent Review. This is the page that makes Decision
// 1 of the IA restructure real: without a cross-run view like this, staff
// have no single place to see "everything I need to clear today" for
// reconciliation, which was exactly the failure mode that lost the
// data-lineage grouping (see src/lib/nav.ts's decision comment).
//
// Batch F1: client/type/reason filters + real database pagination replace
// the previous hard `take: 100` cap. The exception card itself
// (ReconciliationMatchList) and the resolve/ignore action
// (ReconciliationMatchButtons, PATCH /api/reconciliation-matches/:id) are
// unchanged — still no run upload/detail UI here (that's Batch F2).
const RECONCILIATION_TYPES = Object.values(ReconciliationType);
const EXCEPTION_REASONS = Object.values(ReconciliationExceptionReason);
const PAGE_SIZE = 50; // matches the existing per-run exceptions API's own page size (GET /api/reconciliation-runs/[id]/exceptions)

export default async function ReconciliationExceptionsPage({
  searchParams,
}: {
  searchParams: { clientId?: string; type?: string; reason?: string; page?: string };
}) {
  const session = getSession();
  const firmId = session!.firmId;
  const canManageReconciliation = session!.role !== "STAFF";

  const clientId = searchParams.clientId || undefined;
  // Only trust values that are real enum members — anything else is ignored
  // (treated as "no filter") rather than passed to Prisma, which would
  // throw on an invalid enum value.
  const type = searchParams.type && (RECONCILIATION_TYPES as string[]).includes(searchParams.type)
    ? (searchParams.type as ReconciliationType)
    : undefined;
  const reason = searchParams.reason && (EXCEPTION_REASONS as string[]).includes(searchParams.reason)
    ? (searchParams.reason as ReconciliationExceptionReason)
    : undefined;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const hasFilters = !!clientId || !!type || !!reason;

  // clientId and type are ANDed with firmId inside the SAME reconciliationRun
  // relation filter, so a cross-firm or nonexistent clientId can never match
  // another firm's run — the identical structural guarantee used for the
  // Invoice/Quotation client filters (Batch E). No separate ownership check
  // is needed on top of it.
  const where = {
    status: "EXCEPTION" as const,
    reconciliationRun: {
      firmId,
      ...(clientId ? { clientId } : {}),
      ...(type ? { type } : {}),
    },
    ...(reason ? { exceptionReason: reason } : {}),
  };

  const [exceptions, total, clients] = await Promise.all([
    prisma.reconciliationMatch.findMany({
      where,
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reconciliationRun: { select: { type: true, periodStart: true, periodEnd: true, client: { select: { id: true, name: true } } } },
        // Already written correctly by the escalation pipeline (Batch B) — just surfacing it.
        task: { select: { id: true, title: true } },
      },
    }),
    prisma.reconciliationMatch.count({ where }),
    prisma.client.findMany({ where: { firmId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Reconciliation Exceptions</h1>
      <p className="text-sm text-gray-500 mb-4">
        Unresolved mismatches across every reconciliation run — GSTR-2B/1 vs books, and bank vs books — ranked by risk.
        Resolving or ignoring the last exception on a run closes it automatically.
      </p>

      <ReconciliationSubNav active="exceptions" canManageReconciliation={canManageReconciliation} />

      <ReconciliationFilterBar reconciliationTypes={RECONCILIATION_TYPES} exceptionReasons={EXCEPTION_REASONS} clients={clients} />

      <ReconciliationMatchList
        matches={exceptions}
        emptyMessage={
          hasFilters
            ? "No exceptions match the selected filters."
            : "Nothing outstanding. New exceptions appear here as reconciliation runs complete."
        }
      />

      <Pagination pathname="/dashboard/reconciliation" searchParams={searchParams} page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
