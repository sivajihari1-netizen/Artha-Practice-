"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Client = { id: string; name: string; gstin: string | null };
type Item = { description: string; quantity: string; rate: string };

function stateCode(gstin: string | null): string | null {
  if (!gstin || gstin.length < 2) return null;
  return /^\d{2}$/.test(gstin.slice(0, 2)) ? gstin.slice(0, 2) : null;
}

export default function NewInvoiceForm({ clients, firmGstin }: { clients: Client[]; firmGstin: string | null }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", rate: "" }]);
  const [applyGst, setApplyGst] = useState(!!firmGstin);
  const [gstType, setGstType] = useState<"INTRA" | "INTER">("INTRA");
  const [gstRate, setGstRate] = useState("18");
  const [discountType, setDiscountType] = useState<"" | "PERCENT" | "FLAT">("");
  const [discountValue, setDiscountValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClient = clients.find((c) => c.id === clientId);
  const suggestedGstType = useMemo(() => {
    const firmState = stateCode(firmGstin);
    const clientState = stateCode(selectedClient?.gstin ?? null);
    if (!firmState || !clientState) return null;
    return firmState === clientState ? "INTRA" : "INTER";
  }, [firmGstin, selectedClient]);

  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0);
  const discountAmount = discountType === "PERCENT"
    ? subtotal * ((parseFloat(discountValue) || 0) / 100)
    : discountType === "FLAT"
    ? Math.min(parseFloat(discountValue) || 0, subtotal)
    : 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = applyGst ? taxableAmount * ((parseFloat(gstRate) || 0) / 100) : 0;
  const total = taxableAmount + taxAmount;

  function updateItem(idx: number, field: keyof Item, value: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const payload = {
      clientId,
      items: items
        .filter((i) => i.description.trim())
        .map((i) => ({ description: i.description, quantity: parseFloat(i.quantity) || 1, rate: parseFloat(i.rate) || 0 })),
      applyGst,
      gstType: applyGst ? gstType || suggestedGstType || "INTRA" : undefined,
      gstRate: parseFloat(gstRate) || 18,
      discountType: discountType || undefined,
      discountValue: discountType ? parseFloat(discountValue) || 0 : undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      paymentTerms: paymentTerms || undefined,
      notes: notes || undefined,
    };
    const res = await fetch("/api/invoices", {
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
    router.push(`/dashboard/invoices/${data.invoice.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white space-y-4 max-w-2xl">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div>
        <label className="block text-xs font-medium mb-1">Client</label>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {clients.length === 0 && <p className="text-xs text-red-600 mt-1">Add a client first.</p>}
      </div>

      <div>
        <label className="block text-xs font-medium mb-2">Line Items</label>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                placeholder="Description (e.g. GSTR-3B filing — June 2026)"
                value={item.description}
                onChange={(e) => updateItem(idx, "description", e.target.value)}
                className="flex-1 border border-line rounded-md px-2 py-1.5 text-sm"
              />
              <input
                type="number" min="0" step="1" placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                className="w-16 border border-line rounded-md px-2 py-1.5 text-sm"
              />
              <input
                type="number" min="0" step="0.01" placeholder="Rate"
                value={item.rate}
                onChange={(e) => updateItem(idx, "rate", e.target.value)}
                className="w-28 border border-line rounded-md px-2 py-1.5 text-sm"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="text-xs text-gray-400 px-1">✕</button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", rate: "" }])} className="text-xs text-accent font-medium mt-2">
          + Add line item
        </button>
      </div>

      <div className="border-t border-line pt-3">
        <label className="block text-xs font-medium mb-2">Discount (optional)</label>
        <div className="grid grid-cols-2 gap-3">
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "" | "PERCENT" | "FLAT")} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">No discount</option>
            <option value="PERCENT">Percentage (%)</option>
            <option value="FLAT">Flat amount (₹)</option>
          </select>
          {discountType && (
            <input
              type="number" min="0" step="0.01" placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 500"}
              value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
            />
          )}
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={applyGst} onChange={(e) => setApplyGst(e.target.checked)} />
          Apply GST
        </label>
        {applyGst && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className="block text-xs font-medium mb-1">GST Type</label>
              <select value={gstType || suggestedGstType || "INTRA"} onChange={(e) => setGstType(e.target.value as "INTRA" | "INTER")} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
                <option value="INTRA">Intra-state (CGST + SGST)</option>
                <option value="INTER">Inter-state (IGST)</option>
              </select>
              {suggestedGstType && <p className="text-xs text-gray-400 mt-1">Suggested from GSTIN: {suggestedGstType}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">GST Rate (%)</label>
              <input type="number" min="0" step="0.01" value={gstRate} onChange={(e) => setGstRate(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Payment Terms</label>
          <input placeholder="e.g. Due within 7 days" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
      </div>

      <div className="border-t border-line pt-3 text-sm space-y-1">
        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
        {discountAmount > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span>- ₹{discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
        {applyGst && <div className="flex justify-between text-gray-500"><span>Tax</span><span>₹{taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>}
        <div className="flex justify-between font-bold text-base"><span>Total</span><span>₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
      </div>

      <button type="submit" disabled={loading || clients.length === 0} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {loading ? "Creating…" : "Create Invoice"}
      </button>
    </form>
  );
}
