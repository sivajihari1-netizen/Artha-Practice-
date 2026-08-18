import Link from "next/link";
import { ReconciliationMatchButtons } from "@/components/ReconciliationMatchButtons";
import { taskHref } from "@/lib/taskBoard";

// Extracted from the firm-wide Exceptions Queue page (Batch F1) so the F2
// single-run detail page can render the identical exception card — risk
// badge, reason, explanation, client/period line, Task link, Resolve/Ignore
// — without a second, drifting implementation. Purely presentational: the
// caller owns the query, the filters, and the pagination.
const REASON_LABEL: Record<string, string> = {
  MISSING_IN_BOOKS: "Missing in books",
  MISSING_IN_SOURCE: "Missing in source",
  AMOUNT_MISMATCH: "Amount mismatch",
  DATE_MISMATCH: "Date mismatch",
  GSTIN_MISMATCH: "GSTIN mismatch",
  DUPLICATE: "Duplicate",
  RATE_MISMATCH: "Rate mismatch",
};

function riskBadgeClass(riskScore: number): string {
  if (riskScore > 60) return "bg-red-50 text-red-700";
  if (riskScore > 30) return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

export type ReconciliationMatchListItem = {
  id: string;
  riskScore: number;
  exceptionReason: string | null;
  exceptionExplanation: string | null;
  reconciliationRun: {
    type: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    client: { id: string; name: string };
  };
  task: { id: string; title: string } | null;
};

export default function ReconciliationMatchList({
  matches,
  emptyMessage,
}: {
  matches: ReconciliationMatchListItem[];
  emptyMessage: string;
}) {
  if (matches.length === 0) {
    return <div className="border border-line rounded-xl bg-white p-8 text-center text-sm text-gray-400">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <div key={m.id} className="border border-line rounded-xl bg-white p-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskBadgeClass(m.riskScore)}`}>Risk {m.riskScore}</span>
              <span className="text-xs text-gray-400">{REASON_LABEL[m.exceptionReason ?? ""] ?? m.exceptionReason}</span>
            </div>
            <div className="font-medium text-sm">{m.exceptionExplanation ?? "No explanation recorded."}</div>
            <div className="text-xs text-gray-500 mt-1">
              Client: {m.reconciliationRun.client.name} · {m.reconciliationRun.type.replace(/_/g, " ")} ·{" "}
              {new Date(m.reconciliationRun.periodStart).toLocaleDateString("en-IN")}–
              {new Date(m.reconciliationRun.periodEnd).toLocaleDateString("en-IN")}
            </div>
            {m.task && (
              <Link href={taskHref(m.task.id)} className="text-xs text-accent font-medium mt-1 inline-block">
                View task: {m.task.title} →
              </Link>
            )}
          </div>
          <ReconciliationMatchButtons id={m.id} />
        </div>
      ))}
    </div>
  );
}
