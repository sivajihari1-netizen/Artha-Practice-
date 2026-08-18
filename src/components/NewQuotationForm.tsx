"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUOTATION_SERVICE_TYPES, QUOTATION_SERVICE_TYPE_LABELS } from "@/lib/quotationPresets";

type Client = { id: string; name: string };

export default function NewQuotationForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [recipientMode, setRecipientMode] = useState<"client" | "prospect">(clients.length > 0 ? "client" : "prospect");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [serviceType, setServiceType] = useState<typeof QUOTATION_SERVICE_TYPES[number]>("VIRTUAL_CFO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload =
      recipientMode === "client"
        ? { clientId, serviceType }
        : { prospectName, prospectEmail: prospectEmail || undefined, prospectPhone: prospectPhone || undefined, serviceType };

    const res = await fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    const data = await res.json();
    router.push(`/dashboard/quotations/${data.quotation.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white space-y-4 max-w-lg">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div>
        <label className="block text-xs font-medium mb-1">Service Type</label>
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value as typeof serviceType)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
          {QUOTATION_SERVICE_TYPES.map((t) => <option key={t} value={t}>{QUOTATION_SERVICE_TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={recipientMode === "client"} onChange={() => setRecipientMode("client")} disabled={clients.length === 0} />
          Existing client
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={recipientMode === "prospect"} onChange={() => setRecipientMode("prospect")} />
          New prospect
        </label>
      </div>

      {recipientMode === "client" ? (
        <div>
          <label className="block text-xs font-medium mb-1">Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {clients.length === 0 && <p className="text-xs text-red-600 mt-1">No clients yet — use &quot;New prospect&quot; instead.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium mb-1">Prospect Name</label>
            <input required value={prospectName} onChange={(e) => setProspectName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Email</label>
              <input type="email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phone</label>
              <input value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || (recipientMode === "client" && clients.length === 0) || (recipientMode === "prospect" && !prospectName)}
        className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create Quotation"}
      </button>
    </form>
  );
}
