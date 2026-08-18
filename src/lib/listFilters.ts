/**
 * Builds the next URL for a list-page filter change, preserving every other
 * query param already present (so status + client filters compose, and any
 * future param — e.g. search or page — survives a filter change untouched).
 * Pulled out as a pure function so it's unit-testable without jsdom/RTL —
 * ListFilterBar (a "use client" component using next/navigation hooks)
 * can't be rendered under plain Vitest, same constraint as taskHref/
 * resolveQuotationInvoiceAction elsewhere in this codebase.
 */
export function buildFilterUrl(pathname: string, currentParams: URLSearchParams, key: string, value: string): string {
  const params = new URLSearchParams(currentParams.toString());
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Same as buildFilterUrl, but also clears any existing `page` param — the
 * correct behavior whenever a *filter* (not the page control itself)
 * changes, so a stale page number never strands the user past the end of a
 * newly-filtered result set. Introduced for the reconciliation queue
 * (Batch F1), which is the first list page with real pagination — generic
 * enough for any future paginated + filtered list to reuse as-is.
 */
export function buildFilterUrlResettingPage(pathname: string, currentParams: URLSearchParams, key: string, value: string): string {
  const params = new URLSearchParams(currentParams.toString());
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  params.delete("page");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Builds the URL for a plain page-number change, preserving every other active filter untouched. */
export function buildPageUrl(pathname: string, currentParams: URLSearchParams, page: number): string {
  return buildFilterUrl(pathname, currentParams, "page", page > 1 ? String(page) : "");
}
