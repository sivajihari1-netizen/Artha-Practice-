export type QuotationInvoiceAction = "create" | "view" | "none";

/**
 * Pure decision for QuotationActions' one Quotation -> Invoice button (P1
 * batch) — extracted specifically so it's directly unit-testable.
 * QuotationActions itself is a "use client" component with hooks, and this
 * repo has no React render harness (no jsdom/@testing-library/react)
 * configured, so a hook-bearing component can't be exercised directly in a
 * test the way a plain function can — see the equivalent taskHref()/
 * getTaskColumnId() extractions in taskBoard.ts for the same pattern.
 *
 * Deliberately its own file, not a member of src/lib/quotation.ts: that
 * file (and src/lib/invoice.ts, which it imports from) both import the real
 * Prisma client at module scope. QuotationActions.tsx is a "use client"
 * component, so importing anything from either of those files here would
 * pull the entire server-only Prisma Client dependency graph into the
 * browser bundle — confirmed by a build that briefly ballooned
 * /dashboard/quotations/[id]'s First Load JS from ~2 kB to 153 kB before
 * this file was split out.
 */
export function resolveQuotationInvoiceAction(
  status: string,
  clientId: string | null,
  createdInvoiceId: string | null
): QuotationInvoiceAction {
  if (status !== "ACCEPTED" || !clientId) return "none";
  return createdInvoiceId ? "view" : "create";
}
