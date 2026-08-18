"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AgentActionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function act(action: "approve" | "reject") {
    setLoading(action);
    const res = await fetch(`/api/agent-actions/${id}/${action}`, { method: "POST" });
    setLoading(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => act("approve")}
        disabled={loading !== null}
        className="text-xs font-semibold text-accent border border-accent rounded-md px-2.5 py-1 disabled:opacity-60"
      >
        {loading === "approve" ? "…" : "Approve"}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={loading !== null}
        className="text-xs font-semibold text-gray-500 border border-line rounded-md px-2.5 py-1 disabled:opacity-60"
      >
        {loading === "reject" ? "…" : "Reject"}
      </button>
    </div>
  );
}

export function RunTestAgentsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/agent-actions/run-test", { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Test run failed");
  }

  return (
    <div>
      <button onClick={run} disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
        {loading ? "Running…" : "Run Test Agents"}
      </button>
      {error && <div className="text-xs text-red-700 mt-2">{error}</div>}
    </div>
  );
}
