"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildFilterUrlResettingPage } from "@/lib/listFilters";

type ClientOption = { id: string; name: string };

// Same duplicated-not-shared label set as ReconciliationPanel.tsx's own
// TYPE_LABEL (Client 360) — kept local rather than importing from a
// Client-360-rendered component, per Batch F1's explicit instruction not to
// touch anything under Client 360 without stopping to report first. Three
// lines; not worth the cross-boundary coupling.
const TYPE_LABEL: Record<string, string> = {
  GST_2B_VS_PURCHASE: "GSTR-2B vs Purchase Register",
  GST_1_VS_SALES: "GSTR-1 vs Sales",
  BANK_VS_BOOKS: "Bank vs Books",
};

const REASON_LABEL: Record<string, string> = {
  MISSING_IN_BOOKS: "Missing in books",
  MISSING_IN_SOURCE: "Missing in source",
  AMOUNT_MISMATCH: "Amount mismatch",
  DATE_MISMATCH: "Date mismatch",
  GSTIN_MISMATCH: "GSTIN mismatch",
  DUPLICATE: "Duplicate",
  RATE_MISMATCH: "Rate mismatch",
};

// Firm-wide-queue-specific filter dimensions (client, type, reason). F2's
// run-detail page filters on a different shape (status/reason/minRisk,
// implicit client+type since it's already scoped to one run) — a literal
// shared component would need to branch on its caller anyway, so this stays
// its own small component rather than a forced generic framework. It reuses
// the same buildFilterUrlResettingPage convention ListFilterBar (Batch E)
// established with buildFilterUrl, extended here for pagination.
export default function ReconciliationFilterBar({
  reconciliationTypes,
  exceptionReasons,
  clients,
}: {
  reconciliationTypes: string[];
  exceptionReasons: string[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("clientId") ?? "";
  const type = searchParams.get("type") ?? "";
  const reason = searchParams.get("reason") ?? "";
  const hasFilters = !!clientId || !!type || !!reason;

  function update(key: string, value: string) {
    router.push(buildFilterUrlResettingPage(pathname, searchParams, key, value));
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <select
        value={clientId}
        onChange={(e) => update("clientId", e.target.value)}
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-white"
        aria-label="Filter by client"
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select
        value={type}
        onChange={(e) => update("type", e.target.value)}
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-white"
        aria-label="Filter by reconciliation type"
      >
        <option value="">All types</option>
        {reconciliationTypes.map((t) => (
          <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>
        ))}
      </select>
      <select
        value={reason}
        onChange={(e) => update("reason", e.target.value)}
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-white"
        aria-label="Filter by exception reason"
      >
        <option value="">All reasons</option>
        {exceptionReasons.map((r) => (
          <option key={r} value={r}>{REASON_LABEL[r] ?? r}</option>
        ))}
      </select>
      {hasFilters && (
        <button type="button" onClick={() => router.push(pathname)} className="text-xs font-semibold text-accent">
          Clear filters
        </button>
      )}
    </div>
  );
}
