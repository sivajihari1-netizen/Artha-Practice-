"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TYPES = ["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP", "COMPANY", "TRUST", "OTHER"];

export default function AddClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("INDIVIDUAL");
  const [pan, setPan] = useState("");
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, pan: pan || undefined, gstin: gstin || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setName("");
    setPan("");
    setGstin("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-ink text-white rounded-md px-4 py-2 text-sm font-semibold"
      >
        + Add Client
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white mb-6 space-y-3">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Client name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">PAN (optional)</label>
          <input value={pan} onChange={(e) => setPan(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">GSTIN (optional)</label>
          <input value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {loading ? "Saving…" : "Save Client"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
