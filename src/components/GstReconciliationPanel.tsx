"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Reconciliation = {
  id: string;
  period: string;
  createdAt: string;
  matchedCount: number;
  onlyIn2bCount: number;
  onlyInBooksCount: number;
  mismatchCount: number;
};

type ReconItem = {
  id: string;
  supplierGstin: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  taxableValue2b: number | null;
  taxableValueBooks: number | null;
  taxAmount2b: number | null;
  taxAmountBooks: number | null;
  status: "MATCHED" | "ONLY_IN_2B" | "ONLY_IN_BOOKS" | "MISMATCH";
};

const STATUS_LABEL: Record<ReconItem["status"], string> = {
  MATCHED: "Matched",
  ONLY_IN_2B: "Only in GSTR-2B",
  ONLY_IN_BOOKS: "Only in books",
  MISMATCH: "Amount mismatch",
};
const STATUS_COLOR: Record<ReconItem["status"], string> = {
  MATCHED: "text-green-700 bg-green-50",
  ONLY_IN_2B: "text-amber-700 bg-amber-50",
  ONLY_IN_BOOKS: "text-amber-700 bg-amber-50",
  MISMATCH: "text-red-700 bg-red-50",
};

export default function GstReconciliationPanel({
  clientId,
  reconciliations,
}: {
  clientId: string;
  reconciliations: Reconciliation[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("");
  const [booksFile, setBooksFile] = useState<File | null>(null);
  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<ReconItem[] | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!booksFile || !gstr2bFile) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("period", period);
    formData.append("booksFile", booksFile);
    formData.append("gstr2bFile", gstr2bFile);

    const res = await fetch(`/api/clients/${clientId}/gst-reconciliation`, { method: "POST", body: formData });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Reconciliation failed");
      return;
    }
    setPeriod("");
    setBooksFile(null);
    setGstr2bFile(null);
    setOpen(false);
    router.refresh();
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setItems(null);
      return;
    }
    setExpandedId(id);
    setItemsLoading(true);
    const res = await fetch(`/api/gst-reconciliation/${id}`);
    setItemsLoading(false);
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.reconciliation.items);
  }

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">GST Reconciliation</h3>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-accent">
          {open ? "Cancel" : "+ Reconcile"}
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="space-y-2 mb-4 border-b border-line pb-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">{error}</div>}
          <p className="text-xs text-gray-500">
            Upload the client&apos;s purchase register and their GSTR-2B, both as CSV (export GSTR-2B from the GST
            portal as CSV, not JSON). Expected columns: GSTIN, Invoice Number, Invoice Date, Taxable Value, Tax
            Amount (or IGST/CGST/SGST split).
          </p>
          <input
            placeholder="Period (e.g. 2026-06)"
            required
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
          />
          <div>
            <label className="block text-xs font-medium mb-1">Purchase Register (CSV)</label>
            <input type="file" accept=".csv" required onChange={(e) => setBooksFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">GSTR-2B Export (CSV)</label>
            <input type="file" accept=".csv" required onChange={(e) => setGstr2bFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
          </div>
          <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading ? "Reconciling…" : "Run Reconciliation"}
          </button>
        </form>
      )}

      {reconciliations.length === 0 ? (
        <p className="text-xs text-gray-400">No reconciliations run yet.</p>
      ) : (
        <ul className="space-y-2">
          {reconciliations.map((r) => (
            <li key={r.id} className="text-sm border border-line rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.period}</div>
                  <div className="text-xs text-gray-500">
                    {r.matchedCount} matched · {r.mismatchCount} mismatched · {r.onlyIn2bCount} only in 2B ·{" "}
                    {r.onlyInBooksCount} only in books
                  </div>
                </div>
                <button onClick={() => toggleExpand(r.id)} className="text-xs text-accent font-medium">
                  {expandedId === r.id ? "Hide" : "View"}
                </button>
              </div>
              {expandedId === r.id && (
                <div className="mt-3 border-t border-line pt-3 overflow-x-auto">
                  {itemsLoading ? (
                    <p className="text-xs text-gray-400">Loading…</p>
                  ) : (
                    <table className="w-full text-xs min-w-[500px]">
                      <thead className="text-left text-gray-500">
                        <tr>
                          <th className="pb-2 pr-2">Invoice</th>
                          <th className="pb-2 pr-2">GSTIN</th>
                          <th className="pb-2 pr-2">Taxable (2B / Books)</th>
                          <th className="pb-2 pr-2">Tax (2B / Books)</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items?.map((it) => (
                          <tr key={it.id} className="border-t border-line">
                            <td className="py-1.5 pr-2">{it.invoiceNumber}</td>
                            <td className="py-1.5 pr-2 text-gray-500">{it.supplierGstin ?? "—"}</td>
                            <td className="py-1.5 pr-2 text-gray-500">
                              {it.taxableValue2b ?? "—"} / {it.taxableValueBooks ?? "—"}
                            </td>
                            <td className="py-1.5 pr-2 text-gray-500">
                              {it.taxAmount2b ?? "—"} / {it.taxAmountBooks ?? "—"}
                            </td>
                            <td className="py-1.5">
                              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLOR[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
