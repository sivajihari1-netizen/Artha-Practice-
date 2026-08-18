"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function QuotationAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setLoading("accept");
    setError(null);
    const res = await fetch(`/api/public/quotations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  async function decline() {
    setLoading("decline");
    setError(null);
    const res = await fetch(`/api/public/quotations/${token}/decline`, { method: "POST" });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-inv-border bg-inv-secondary p-5 print:hidden">
      <div className="text-sm font-bold mb-3">Ready to proceed?</div>
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3">{error}</div>}
      <form onSubmit={accept} className="flex flex-col sm:flex-row gap-2">
        <input
          required value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Type your full name to accept"
          className="flex-1 border border-inv-border rounded-md px-3 py-2 text-sm bg-white"
        />
        <button type="submit" disabled={loading !== null} className="bg-inv-primary text-white rounded-md px-5 py-2 text-sm font-semibold disabled:opacity-60">
          {loading === "accept" ? "Accepting…" : "Accept Proposal"}
        </button>
        <button type="button" onClick={decline} disabled={loading !== null} className="border border-red-300 text-red-600 rounded-md px-5 py-2 text-sm font-semibold disabled:opacity-60">
          {loading === "decline" ? "Declining…" : "Decline"}
        </button>
      </form>
      <p className="text-[11px] text-inv-accent/50 mt-2">
        By typing your name and clicking Accept, you confirm agreement to the scope, fee, and terms above.
      </p>
    </div>
  );
}
