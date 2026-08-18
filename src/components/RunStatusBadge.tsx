// Shared between the run list and run detail page (F2) — every
// ReconciliationRunStatus value gets one consistent label/color wherever a
// run's status is shown. UPLOADED/EXTRACTING/EXTRACTED/MATCHING are
// transient (the pipeline runs synchronously in the upload request, so a
// user only ever sees these mid-flight); REVIEWED exists on the enum but no
// code path currently sets it — included anyway so an unexpected value never
// falls through to the generic gray "unknown" look.
const STATUS_LABEL: Record<string, string> = {
  UPLOADED: "Uploaded",
  EXTRACTING: "Extracting…",
  EXTRACTED: "Extracted",
  MATCHING: "Matching…",
  MATCHED: "Matched",
  REVIEWED: "Reviewed",
  CLOSED: "Closed",
  FAILED: "Failed",
};

const STATUS_CLASS: Record<string, string> = {
  UPLOADED: "bg-gray-100 text-gray-600",
  EXTRACTING: "bg-amber-50 text-amber-700",
  EXTRACTED: "bg-gray-100 text-gray-600",
  MATCHING: "bg-amber-50 text-amber-700",
  MATCHED: "bg-blue-50 text-blue-700",
  REVIEWED: "bg-blue-50 text-blue-700",
  CLOSED: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
};

export default function RunStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CLASS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
