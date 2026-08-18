"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WORK_TYPES, WORK_TYPE_LABELS, MONTH_NAMES } from "@/lib/documentOrganize";

type Doc = { id: string; category: string; workType: string | null; periodYear: number | null; periodMonth: number | null };

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export default function DocumentReclassifyForm({ doc, onDone }: { doc: Doc; onDone: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState(doc.category);
  const [workType, setWorkType] = useState(doc.workType ?? "");
  const [periodYear, setPeriodYear] = useState(doc.periodYear ? String(doc.periodYear) : "");
  const [periodMonth, setPeriodMonth] = useState(doc.periodMonth ? String(doc.periodMonth) : "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        workType: workType || null,
        periodYear: periodYear ? parseInt(periodYear, 10) : null,
        periodMonth: periodMonth ? parseInt(periodMonth, 10) : null,
      }),
    });
    setLoading(false);
    onDone();
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 bg-paper-dim rounded-md p-2 mt-2">
      <input value={category} onChange={(e) => setCategory(e.target.value)} className="border border-line rounded-md px-2 py-1 text-xs w-32" placeholder="Category" />
      <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="border border-line rounded-md px-2 py-1 text-xs">
        <option value="">Work type…</option>
        {WORK_TYPES.map((w) => <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>)}
      </select>
      <select value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} className="border border-line rounded-md px-2 py-1 text-xs">
        <option value="">Year…</option>
        {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="border border-line rounded-md px-2 py-1 text-xs">
        <option value="">Month…</option>
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <button onClick={save} disabled={loading} className="bg-accent text-white rounded-md px-2 py-1 text-xs font-semibold disabled:opacity-60">
        {loading ? "Saving…" : "Save"}
      </button>
      <button onClick={onDone} className="text-xs text-gray-400">Cancel</button>
    </div>
  );
}
