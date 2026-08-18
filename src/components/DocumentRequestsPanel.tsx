"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { taskHref } from "@/lib/taskBoard";

type Item = { id: string; label: string; fulfilled: boolean };
type Request = {
  id: string;
  note: string | null;
  status: "PENDING" | "PARTIAL" | "COMPLETE" | "EXPIRED";
  createdAt: string;
  items: Item[];
  taskId: string | null;
};
type TaskOption = { id: string; title: string };

const STATUS_COLOR: Record<Request["status"], string> = {
  PENDING: "text-gray-500",
  PARTIAL: "text-amber-600",
  COMPLETE: "text-accent",
  EXPIRED: "text-red-600",
};

export default function DocumentRequestsPanel({ clientId, requests, tasks = [] }: { clientId: string; requests: Request[]; tasks?: TaskOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<string[]>([""]);
  const [note, setNote] = useState("");
  const [taskId, setTaskId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminding, setReminding] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items = labels.map((l) => l.trim()).filter(Boolean);
    if (items.length === 0) {
      setError("Add at least one document to request");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/document-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, note: note || undefined, taskId: taskId || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setLabels([""]);
    setNote("");
    setTaskId("");
    setOpen(false);
    router.refresh();
  }

  async function remind(id: string) {
    setReminding(id);
    await fetch(`/api/document-requests/${id}/remind`, { method: "POST" });
    setReminding(null);
    router.refresh();
  }

  /** Explicit, staff-chosen link — never inferred. */
  async function linkTask(id: string, newTaskId: string) {
    const res = await fetch(`/api/document-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: newTaskId || null }),
    });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not update the linked task");
    }
  }

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Document Requests (WhatsApp)</h3>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-accent">
          {open ? "Cancel" : "+ Request"}
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="space-y-2 mb-4 border-b border-line pb-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">{error}</div>}
          <p className="text-xs text-gray-500">
            Sends a WhatsApp message to the client&apos;s primary contact with a secure link to upload these documents —
            no login required on their end.
          </p>
          {labels.map((label, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder={`Document ${i + 1} (e.g. Bank Statement — March 2026)`}
                value={label}
                onChange={(e) => setLabels((prev) => prev.map((l, idx) => (idx === i ? e.target.value : l)))}
                className="flex-1 border border-line rounded-md px-2 py-1.5 text-sm"
              />
              {labels.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLabels((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-gray-400 px-1"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setLabels((prev) => [...prev, ""])} className="text-xs text-accent font-medium">
            + Add another document
          </button>
          <input
            placeholder="Note to client (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-line rounded-md px-2 py-1.5 text-sm"
          />
          {tasks.length > 0 && (
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm">
              <option value="">Not linked to a task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          )}
          <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading ? "Sending…" : "Send Request"}
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-xs text-gray-400">No document requests sent yet.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="text-sm border border-line rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                <div className="flex items-center gap-2">
                  {tasks.length > 0 && (
                    <select
                      value={r.taskId ?? ""}
                      onChange={(e) => linkTask(r.id, e.target.value)}
                      className="text-xs border border-line rounded px-1 py-0.5 text-gray-600"
                      title="Link to task"
                    >
                      <option value="">Not linked to a task</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  )}
                  {r.taskId && (
                    <Link href={taskHref(r.taskId)} className="text-xs text-accent font-medium">
                      View task →
                    </Link>
                  )}
                  {r.status !== "COMPLETE" && r.status !== "EXPIRED" && (
                    <button onClick={() => remind(r.id)} disabled={reminding === r.id} className="text-xs text-accent font-medium disabled:opacity-60">
                      {reminding === r.id ? "Sending…" : "Remind"}
                    </button>
                  )}
                </div>
              </div>
              <ul className="text-xs text-gray-500 space-y-0.5">
                {r.items.map((item) => (
                  <li key={item.id}>
                    {item.fulfilled ? "✓" : "○"} {item.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
