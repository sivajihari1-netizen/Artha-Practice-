"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WORK_TYPES, WORK_TYPE_LABELS, MONTH_NAMES, UNCATEGORIZED, yearLabel, monthLabel } from "@/lib/documentOrganize";
import { taskHref } from "@/lib/taskBoard";

type Doc = {
  id: string;
  fileName: string;
  category: string;
  workType: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  sizeBytes: number | null;
  uploadedAt: string;
  taskId: string | null;
};

type TaskOption = { id: string; title: string };

const CATEGORIES = ["Income Proof", "GST Docs", "ITR", "Bank Statement", "Agreement", "Uncategorized"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export default function DocumentsPanel({ clientId, documents, tasks = [] }: { clientId: string; documents: Doc[]; tasks?: TaskOption[] }) {
  const router = useRouter();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [workType, setWorkType] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byYear = new Map<string, Map<string, Map<string, Doc[]>>>();
    for (const d of documents) {
      const y = d.periodYear ? String(d.periodYear) : UNCATEGORIZED;
      const w = d.workType ?? UNCATEGORIZED;
      const m = d.periodMonth ? String(d.periodMonth) : UNCATEGORIZED;
      if (!byYear.has(y)) byYear.set(y, new Map());
      const byWork = byYear.get(y)!;
      if (!byWork.has(w)) byWork.set(w, new Map());
      const byMonth = byWork.get(w)!;
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(d);
    }
    return byYear;
  }, [documents]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    if (workType) formData.append("workType", workType);
    if (periodYear) formData.append("periodYear", periodYear);
    if (periodMonth) formData.append("periodMonth", periodMonth);

    const res = await fetch(`/api/clients/${clientId}/documents`, { method: "POST", body: formData });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed");
      return;
    }
    setFile(null);
    router.refresh();
  }

  async function download(id: string) {
    const res = await fetch(`/api/documents/${id}/download`);
    if (!res.ok) return;
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  async function replace(id: string, newFile: File) {
    const formData = new FormData();
    formData.append("file", newFile);
    const res = await fetch(`/api/documents/${id}/replace`, { method: "POST", body: formData });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Replace failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document? It can still be recovered from the audit log if needed.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  /** Explicit, staff-chosen link — never inferred from filename or auto-attached. */
  async function linkTask(id: string, taskId: string) {
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: taskId || null }),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not update the linked task");
    }
  }

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <h3 className="font-bold text-sm mb-3">Documents</h3>

      <form onSubmit={upload} className="space-y-2 mb-4 border-b border-line pb-4">
        {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">{error}</div>}
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">Work type…</option>
            {WORK_TYPES.map((w) => <option key={w} value={w}>{WORK_TYPE_LABELS[w]}</option>)}
          </select>
          <select value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">Year…</option>
            {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
            <option value="">Month…</option>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
        <button type="submit" disabled={loading || !file} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
          {loading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {documents.length === 0 ? (
        <p className="text-xs text-gray-400">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, byWork]) => (
            <div key={year}>
              <div className="text-xs font-bold text-charcoal mb-1.5">{yearLabel(year)}</div>
              <div className="space-y-2 pl-2 border-l border-line">
                {[...byWork.entries()].map(([work, byMonth]) => (
                  <div key={work}>
                    <div className="text-xs font-semibold text-gray-500 mb-1">{work === UNCATEGORIZED ? "Uncategorized" : WORK_TYPE_LABELS[work as keyof typeof WORK_TYPE_LABELS] ?? work}</div>
                    <ul className="space-y-1.5 pl-2">
                      {[...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([month, docs]) =>
                        docs.map((d) => (
                          <li key={d.id} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium">{d.fileName}</div>
                              <div className="text-xs text-gray-500">
                                {d.category}{month !== UNCATEGORIZED ? ` · ${monthLabel(month)}` : ""} · {d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : ""}
                                {d.taskId && (
                                  <>
                                    {" "}
                                    · Linked to:{" "}
                                    <Link href={taskHref(d.taskId)} className="text-accent hover:underline">
                                      {tasks.find((t) => t.id === d.taskId)?.title ?? "a task"}
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              {tasks.length > 0 && (
                                <select
                                  value={d.taskId ?? ""}
                                  onChange={(e) => linkTask(d.id, e.target.value)}
                                  className="text-xs border border-line rounded px-1 py-0.5 text-gray-600"
                                  title="Link to task"
                                >
                                  <option value="">No linked task</option>
                                  {tasks.map((t) => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                  ))}
                                </select>
                              )}
                              <button onClick={() => download(d.id)} className="text-xs text-accent font-medium">
                                Download
                              </button>
                              <label className="text-xs text-gray-500 font-medium cursor-pointer">
                                Replace
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) replace(d.id, f);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <button onClick={() => remove(d.id)} className="text-xs text-gray-400 hover:text-red-600 font-medium">
                                Delete
                              </button>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
