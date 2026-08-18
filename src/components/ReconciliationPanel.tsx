import Link from "next/link";

type LatestRun = {
  id: string;
  type: "GST_2B_VS_PURCHASE" | "GST_1_VS_SALES" | "BANK_VS_BOOKS";
  status: "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "MATCHING" | "MATCHED" | "REVIEWED" | "CLOSED" | "FAILED";
  periodStart: Date | string;
  periodEnd: Date | string;
  matchedCount: number;
  exceptionCount: number;
  unresolvedCount: number;
} | null;

const TYPE_LABEL: Record<NonNullable<LatestRun>["type"], string> = {
  GST_2B_VS_PURCHASE: "GSTR-2B vs Purchase Register",
  GST_1_VS_SALES: "GSTR-1 vs Sales",
  BANK_VS_BOOKS: "Bank vs Books",
};

/**
 * Read-only summary of the Reconciliation Exception Engine (ReconciliationRun),
 * not the legacy GstReconciliation tool — those stay two separate panels per
 * P0.3 ("keep the legacy functionality intact"). Runs are created from the
 * reconciliation upload flow, not from here.
 */
export default function ReconciliationPanel({ latestRun, totalRunCount }: { latestRun: LatestRun; totalRunCount: number }) {
  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Reconciliation</h3>
        <Link href="/dashboard/reconciliation" className="text-xs font-semibold text-accent">
          View exceptions
        </Link>
      </div>
      {!latestRun ? (
        <p className="text-xs text-gray-400">No reconciliation runs for this client yet.</p>
      ) : (
        <div className="text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">{TYPE_LABEL[latestRun.type]}</span>
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                latestRun.unresolvedCount > 0 ? "text-amber-700 bg-amber-50" : "text-green-700 bg-green-50"
              }`}
            >
              {latestRun.unresolvedCount > 0 ? `${latestRun.unresolvedCount} unresolved` : latestRun.status === "CLOSED" ? "Closed" : latestRun.status}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {new Date(latestRun.periodStart).toLocaleDateString("en-IN")}–{new Date(latestRun.periodEnd).toLocaleDateString("en-IN")} ·{" "}
            {latestRun.matchedCount} matched · {latestRun.exceptionCount} exception{latestRun.exceptionCount === 1 ? "" : "s"} found
          </div>
          {totalRunCount > 1 && <div className="text-xs text-gray-400 mt-2">{totalRunCount - 1} earlier run{totalRunCount - 1 === 1 ? "" : "s"} for this client</div>}
        </div>
      )}
    </div>
  );
}
