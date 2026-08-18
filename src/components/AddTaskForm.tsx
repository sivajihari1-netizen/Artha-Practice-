"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };
type WorkflowOption = { id: string; name: string; key: string; systemKey: string | null; isActive: boolean; sortOrder: number; color: string | null };

export default function AddTaskForm({ clients, staff, statusOptions, categoryOptions }: { clients: Option[]; staff: Option[]; statusOptions: WorkflowOption[]; categoryOptions: WorkflowOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [statusOptionId, setStatusOptionId] = useState(() => statusOptions.find((o) => o.systemKey === "TODO")?.id ?? statusOptions[0]?.id ?? "");
  const [categoryOptionId, setCategoryOptionId] = useState(() => categoryOptions.find((o) => o.systemKey === "OTHER")?.id ?? categoryOptions[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStatusOptions = useMemo(() => statusOptions.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [statusOptions]);
  const activeCategoryOptions = useMemo(() => categoryOptions.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder), [categoryOptions]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        clientId: clientId || undefined,
        statusOptionId: statusOptionId || undefined,
        categoryOptionId: categoryOptionId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigneeId: assigneeId || undefined,
        priority: priority || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setTitle("");
    setClientId("");
    setDueDate("");
    setAssigneeId("");
    setPriority("");
    setStatusOptionId(activeStatusOptions.find((o) => o.systemKey === "TODO")?.id ?? activeStatusOptions[0]?.id ?? "");
    setCategoryOptionId(activeCategoryOptions.find((o) => o.systemKey === "OTHER")?.id ?? activeCategoryOptions[0]?.id ?? "");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-ink text-white rounded-md px-4 py-2 text-sm font-semibold">
        + Add Task
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white mb-6 space-y-3">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium mb-1">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            <option value="">— none —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Category</label>
          <select value={categoryOptionId} onChange={(e) => setCategoryOptionId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            {activeCategoryOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Status</label>
          <select value={statusOptionId} onChange={(e) => setStatusOptionId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            {activeStatusOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            <option value="">None</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Assignee</label>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {loading ? "Saving…" : "Save Task"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </form>
  );
}
