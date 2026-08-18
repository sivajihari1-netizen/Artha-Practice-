"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildResolveRequestBody, resolutionNoteError, type ResolutionAction } from "@/lib/reconciliationResolution";

// Resolve/Ignore now open a small inline note panel instead of firing
// immediately — see src/lib/reconciliationResolution.ts for the pure
// request-building/validation logic. The note is optional: the existing API
// (src/app/api/reconciliation-matches/[id]/route.ts) already treats it as
// optional, and this UI doesn't invent a requirement the backend doesn't have.
export function ReconciliationMatchButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<ResolutionAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openPanel(action: ResolutionAction) {
    setPendingAction(action);
    setNote("");
    setError(null);
  }

  function cancel() {
    setPendingAction(null);
    setNote("");
    setError(null);
  }

  async function confirm() {
    if (!pendingAction) return;
    const lengthError = resolutionNoteError(note);
    if (lengthError) {
      setError(lengthError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/reconciliation-matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildResolveRequestBody(pendingAction, note)),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  if (pendingAction) {
    const isResolve = pendingAction === "resolve";
    return (
      <div className="w-64 shrink-0 border border-line rounded-lg p-2.5 bg-paper-dim/40">
        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1 mb-2">{error}</div>}
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Reason / resolution note (optional)
        </label>
        <textarea
          autoFocus
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isResolve ? "e.g. Confirmed with client, invoice booked late." : "e.g. Immaterial rounding difference."}
          className="w-full border border-line rounded-md px-2 py-1.5 text-xs mb-2"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={confirm}
            disabled={submitting}
            className={`text-xs font-semibold rounded-md px-2.5 py-1 disabled:opacity-60 ${
              isResolve ? "bg-accent text-white" : "border border-line text-gray-600"
            }`}
          >
            {submitting ? "…" : isResolve ? "Confirm Resolve" : "Confirm Ignore"}
          </button>
          <button onClick={cancel} disabled={submitting} className="text-xs font-medium text-gray-400 disabled:opacity-60">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => openPanel("resolve")}
        className="text-xs font-semibold text-accent border border-accent rounded-md px-2.5 py-1"
      >
        Resolve
      </button>
      <button
        onClick={() => openPanel("ignore")}
        className="text-xs font-semibold text-gray-500 border border-line rounded-md px-2.5 py-1"
      >
        Ignore
      </button>
    </div>
  );
}
