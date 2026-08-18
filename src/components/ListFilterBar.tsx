"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildFilterUrl } from "@/lib/listFilters";

type ClientOption = { id: string; name: string };

// Shared between the Invoice and Quotation list pages (Batch E) — same two
// filters, same behavior, same markup — kept as one component so the two
// pages can't quietly drift apart in how filtering looks or works.
export default function ListFilterBar({
  statusOptions,
  clients,
  statusLabel = "All statuses",
}: {
  statusOptions: string[];
  clients: ClientOption[];
  statusLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const clientId = searchParams.get("clientId") ?? "";
  const hasFilters = !!status || !!clientId;

  function update(key: string, value: string) {
    router.push(buildFilterUrl(pathname, searchParams, key, value));
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <select
        value={status}
        onChange={(e) => update("status", e.target.value)}
        className="border border-line rounded-md px-3 py-1.5 text-sm bg-white"
        aria-label="Filter by status"
      >
        <option value="">{statusLabel}</option>
        {statusOptions.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
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
      {hasFilters && (
        <button type="button" onClick={() => router.push(pathname)} className="text-xs font-semibold text-accent">
          Clear filters
        </button>
      )}
    </div>
  );
}
