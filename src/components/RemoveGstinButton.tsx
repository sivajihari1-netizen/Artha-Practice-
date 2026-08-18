"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveGstinButton({ clientId, gstinId }: { clientId: string; gstinId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onRemove() {
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/gstins/${gstinId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) router.refresh();
  }

  return (
    <button onClick={onRemove} disabled={loading} className="text-xs text-gray-400 hover:text-red-600 shrink-0">
      {loading ? "…" : "✕"}
    </button>
  );
}
