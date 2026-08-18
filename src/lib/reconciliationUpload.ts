// Pure, unit-testable helpers backing ReconciliationUploadForm ("use client",
// untestable directly under plain Vitest — same constraint as every other
// hook-bearing form component in this app). These mirror the backend's own
// validation in POST /api/clients/[id]/reconciliation-runs exactly — they
// exist purely to improve UX (accept attributes, an early error message)
// before the request is even sent. The API route remains the authoritative
// check; nothing here replaces it.

export type ReconciliationTypeValue = "GST_2B_VS_PURCHASE" | "GST_1_VS_SALES" | "BANK_VS_BOOKS";

// JSON is only exposed for GST_2B_VS_PURCHASE. The backend's route technically
// accepts a .json source-A file for GST_1_VS_SALES too (allowJsonA = type !==
// "BANK_VS_BOOKS"), but the only JSON extractor that exists
// (extractGstr2bJson, src/lib/reconciliation/extract.ts) is hardcoded to the
// GST portal's GSTR-2B shape — a real GSTR-1 JSON export has no matching
// parser and would either fail extraction or, worse, silently go through the
// flat-array fallback with the wrong type baked into its normalized key.
// This is a pre-existing backend gap (route permissiveness outrunning what
// the extractor actually, correctly supports), not something F2 is
// authorized to fix — so the UI deliberately doesn't expose the unreliable
// path. See the F2 final report's upload-format audit for the full trace.
export function sourceAAccept(type: ReconciliationTypeValue): string {
  if (type === "GST_2B_VS_PURCHASE") return ".csv,.xlsx,.xls,.json";
  return ".csv,.xlsx,.xls";
}

// Source B (the books/purchase/sales register) never accepts JSON for any
// type — the backend always passes allowJson:false for source B.
export const SOURCE_B_ACCEPT = ".csv,.xlsx,.xls";

// Must match MAX_SIZE_BYTES in src/app/api/clients/[id]/reconciliation-runs/route.ts exactly.
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_LABEL = "10 MB";

export function isAcceptedExtension(fileName: string, accept: string): boolean {
  const name = fileName.toLowerCase();
  return accept.split(",").some((ext) => name.endsWith(ext));
}
