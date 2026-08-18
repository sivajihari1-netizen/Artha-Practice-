"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// F2.6 — thin wrapper around the existing POST /api/reconciliation-runs/[id]/rerun
// route. No new business process: the route itself already rejects a run
// that hasn't finished extracting (409), and already documents that prior
// resolution notes are discarded on rerun — this button doesn't add any
// behavior beyond triggering it with a clear warning first.
export default function ReconciliationRerunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerun() {
    if (
      !confirm(
        "Re-run matching for this reconciliation run? This re-matches the already-extracted rows — any resolution notes already recorded on this run's exceptions will be discarded."
      )
    ) {
      return;
    }
    setRunning(true);
    setError(null);
    const res = await fetch(`/api/reconciliation-runs/${runId}/rerun`, { method: "POST" });
    setRunning(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mb-2">{error}</div>}
      <button
        type="button"
        onClick={rerun}
        disabled={running}
        className="text-xs font-semibold text-accent border border-accent rounded-md px-3 py-1.5 disabled:opacity-60"
      >
        {running ? "Re-running…" : "Rerun matching"}
      </button>
    </div>
  );
}
