"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TaskTemplateRow from "@/components/TaskTemplateRow";

type Template = {
  id: string;
  title: string;
  returnType: string;
  recurrence: string;
  active: boolean;
};

const RETURN_TYPES = ["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"];
const RECURRENCES = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];

// Mirrors src/lib/mcaTemplates.ts — kept as a small literal here too since
// that file is server-only-adjacent (imported by the signup route) and this
// is a client component; duplicating 4 short rows is simpler than sharing
// across the server/client boundary for something this small.
const FIXED_DATE_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function formatRecurrence(recurrence: string): string {
  const m = recurrence.match(/^ANNUAL:(\d{2})-(\d{2})$/i);
  if (!m) return recurrence;
  const [, month, day] = m;
  return `Annual — ${FIXED_DATE_LABELS[month] ?? month} ${parseInt(day, 10)}`;
}

const MCA_TEMPLATES = [
  { title: "AOC-4 — Annual Financial Statements", returnType: "ROC", recurrence: "ANNUAL:10-30" },
  { title: "MGT-7 / MGT-7A — Annual Return", returnType: "ROC", recurrence: "ANNUAL:11-29" },
  { title: "DIR-3 KYC — Director KYC", returnType: "ROC", recurrence: "ANNUAL:09-30" },
  { title: "DPT-3 — Return of Deposits", returnType: "ROC", recurrence: "ANNUAL:06-30" },
];

export default function TaskTemplatesPanel({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [returnType, setReturnType] = useState("GST");
  const [recurrence, setRecurrence] = useState("MONTHLY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMca, setAddingMca] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/task-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, returnType, recurrence }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setTitle("");
    router.refresh();
  }

  async function addMcaDeadlines() {
    setAddingMca(true);
    setError(null);
    for (const t of MCA_TEMPLATES) {
      if (templates.some((existing) => existing.title === t.title)) continue;
      await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(t),
      });
    }
    setAddingMca(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-extrabold">Recurring Task Templates</h1>
        <button
          onClick={addMcaDeadlines}
          disabled={addingMca}
          className="text-xs font-semibold text-accent border border-accent rounded-md px-3 py-1.5 disabled:opacity-60 shrink-0"
        >
          {addingMca ? "Adding…" : "+ Add Standard MCA Deadlines"}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Tasks are auto-created for every active client, once per period, based on these templates. Wire up the
        daily cron at <code className="bg-paper-dim px-1 rounded">/api/cron/generate-recurring-tasks</code> to run
        it automatically (see README). &quot;Add Standard MCA Deadlines&quot; adds AOC-4, MGT-7, DIR-3 KYC and DPT-3 with
        their fixed statutory due dates.
      </p>

      <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white mb-6 space-y-3">
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monthly GSTR-3B" className="w-full border border-line rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Return Type</label>
            <select value={returnType} onChange={(e) => setReturnType(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
              {RETURN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Recurrence</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
              {RECURRENCES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {loading ? "Saving…" : "Save Template"}
        </button>
      </form>

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Return Type</th>
              <th className="px-4 py-3 font-medium">Recurrence</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <TaskTemplateRow key={t.id} template={t} formatRecurrence={formatRecurrence} />
            ))}
            {templates.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No templates yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
