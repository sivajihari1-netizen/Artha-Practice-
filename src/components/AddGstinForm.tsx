"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddGstinForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gstin, setGstin] = useState("");
  const [qrmpOpted, setQrmpOpted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/gstins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gstin, qrmpOpted }),
    });
    setLoading(false);
    if (res.ok) {
      setGstin("");
      setQrmpOpted(false);
      setOpen(false);
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Something went wrong");
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-accent">
        + Add
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 mb-3 border-b border-line pb-3">
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{error}</div>}
      <input
        placeholder="GSTIN (15 characters)"
        required
        maxLength={15}
        value={gstin}
        onChange={(e) => setGstin(e.target.value.toUpperCase())}
        className="w-full border border-line rounded-md px-2 py-1.5 text-sm uppercase"
      />
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={qrmpOpted} onChange={(e) => setQrmpOpted(e.target.checked)} />
        Opted for QRMP (quarterly return, monthly payment)
      </label>
      <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
        {loading ? "Saving…" : "Save GSTIN"}
      </button>
    </form>
  );
}
