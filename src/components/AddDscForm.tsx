"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddDscForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [holderName, setHolderName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/dsc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holderName,
        location: location || undefined,
        expiresAt: new Date(expiresAt).toISOString(),
      }),
    });
    setLoading(false);
    if (res.ok) {
      setHolderName("");
      setExpiresAt("");
      setLocation("");
      setOpen(false);
      router.refresh();
    }
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
      <input placeholder="Holder name" required value={holderName} onChange={(e) => setHolderName(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <input type="date" required value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <input placeholder="Custody location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
        {loading ? "Saving…" : "Save DSC"}
      </button>
    </form>
  );
}
