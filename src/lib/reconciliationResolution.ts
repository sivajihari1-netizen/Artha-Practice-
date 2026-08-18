// Pure helpers for the resolve/ignore-with-note UI in
// src/components/ReconciliationMatchButtons.tsx — kept separate from the
// component so the request-building and validation logic is testable without
// a DOM (same pure-function-extraction convention as src/lib/navLogic.ts).
//
// MAX_RESOLUTION_NOTE_LENGTH mirrors the z.string().max(2000) constraint in
// src/app/api/reconciliation-matches/[id]/route.ts — duplicated as a literal
// rather than imported, since the API route module pulls in server-only
// dependencies (prisma, next/headers via requireSession) that a client
// component must not bundle.
export const MAX_RESOLUTION_NOTE_LENGTH = 2000;

export type ResolutionAction = "resolve" | "ignore";

export type ResolveRequestBody = { action: ResolutionAction; note?: string };

/** Trims the note and omits it entirely when blank, matching the API's optional `note`. */
export function buildResolveRequestBody(action: ResolutionAction, rawNote: string): ResolveRequestBody {
  const trimmed = rawNote.trim();
  return trimmed ? { action, note: trimmed } : { action };
}

/** Client-side pre-check so a too-long note fails fast instead of round-tripping to the API. */
export function resolutionNoteError(rawNote: string): string | null {
  if (rawNote.trim().length > MAX_RESOLUTION_NOTE_LENGTH) {
    return `Note is too long (${rawNote.trim().length}/${MAX_RESOLUTION_NOTE_LENGTH} characters).`;
  }
  return null;
}
