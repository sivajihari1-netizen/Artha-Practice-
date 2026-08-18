// Pure helper for the notes preview shown on each Lead card in
// src/components/LeadsBoard.tsx — kept separate so it's testable without a
// DOM (same convention as src/lib/reconciliationResolution.ts).
export function leadNotePreview(note: string | null | undefined, maxLength = 60): string {
  const trimmed = (note ?? "").trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength).trimEnd()}…` : trimmed;
}
