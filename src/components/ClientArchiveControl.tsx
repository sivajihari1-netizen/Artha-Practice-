"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Client archive/reactivate (Batch C) — wired to the existing DELETE/PATCH
 * /api/clients/[id] (both unchanged; this adds no new endpoint). DELETE is
 * already a soft delete server-side ("Soft delete — keeps history intact",
 * see that route's own comment) — tasks, documents, invoices, quotations
 * all remain exactly as they were, only Client.active flips to false.
 * Reactivation reuses the same PATCH the rest of the client-edit flow uses.
 */
export default function ClientArchiveControl({ clientId, active }: { clientId: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (active && !confirm("Archive this client? Their tasks, documents, invoices and history are all kept — this only removes them from the active client list.")) {
      return;
    }
    setLoading(true);
    setError(null);
    const res = active
      ? await fetch(`/api/clients/${clientId}`, { method: "DELETE" })
      : await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {!active && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Archived</span>}
      <button onClick={toggle} disabled={loading} className="text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-60">
        {loading ? "…" : active ? "Archive Client" : "Reactivate Client"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
