"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EditTurnoverForm({ clientId, turnover }: { clientId: string; turnover: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(turnover != null ? String(turnover) : "");
  const [loading, setLoading] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnover: value ? parseFloat(value) : undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-accent font-medium">
        {turnover != null ? `Turnover ₹${turnover.toLocaleString("en-IN")} (edit)` : "+ Add turnover"}
      </button>
    );
  }

  return (
    <form onSubmit={onSave} className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        placeholder="Annual turnover (INR)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border border-line rounded-md px-2 py-1 text-xs w-40"
      />
      <button type="submit" disabled={loading} className="text-xs font-semibold text-accent">
        {loading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
