"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTaskColumnId, priorityRank, formatDocRequestSummary, taskHref } from "@/lib/taskBoard";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;

type Task = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: Priority;
  dueDate: string | null;
  returnType: string;
  client: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  statusOption: { id: string; name: string; systemKey: string | null } | null;
  categoryOption: { id: string; name: string; systemKey: string | null } | null;
  /** Aggregated across every DocumentRequest linked to this task — null when none is linked (nothing to show). */
  documentRequestSummary: { total: number; fulfilled: number } | null;
};

type WorkflowOption = { id: string; name: string; key: string; systemKey: string | null; isActive: boolean; sortOrder: number; color: string | null };
type StaffOption = { id: string; name: string };

const PRIORITY_LABEL: Record<Exclude<Priority, null>, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
const PRIORITY_COLOR: Record<Exclude<Priority, null>, string> = {
  LOW: "text-gray-500 bg-gray-100",
  MEDIUM: "text-blue-700 bg-blue-50",
  HIGH: "text-amber-700 bg-amber-50",
  URGENT: "text-red-700 bg-red-50",
};

function isOverdue(task: Task) {
  return task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date();
}

export default function KanbanBoard({
  tasks,
  statusOptions,
  staff = [],
  canReassign = false,
}: {
  tasks: Task[];
  statusOptions: WorkflowOption[];
  /** Firm's assignable staff, for the reassignment control — empty/omitted when the caller doesn't have it (e.g. read-only contexts). */
  staff?: StaffOption[];
  /** Partner/Manager only — Staff can see who a task is assigned to but not change it (see the PATCH route's own matching check). */
  canReassign?: boolean;
}) {
  const router = useRouter();
  const [priorityFilter, setPriorityFilter] = useState<"" | Exclude<Priority, null>>("");

  const columns = useMemo(
    () => statusOptions.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [statusOptions]
  );

  const visibleTasks = useMemo(
    () => (priorityFilter ? tasks.filter((t) => t.priority === priorityFilter) : tasks),
    [tasks, priorityFilter]
  );

  async function moveTask(id: string, target: WorkflowOption) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusOptionId: target.id, status: target.systemKey ?? undefined }),
    });
    router.refresh();
  }

  async function reassign(id: string, assigneeId: string) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: assigneeId || null }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 font-medium">Priority:</label>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
          className="text-xs border border-line rounded px-2 py-1"
        >
          <option value="">All</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(220px, 1fr))` }}>
        {columns.map((col) => {
          // Priority is the secondary ordering signal within a column;
          // due date (already the list's primary order from the server
          // query) stays the tiebreaker — never overridden, only refined.
          const colTasks = visibleTasks
            .filter((t) => getTaskColumnId(t, columns) === col.id)
            .slice()
            .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
          return (
            <div key={col.id} className="border border-line rounded-xl bg-white p-3 min-h-[300px]">
              <div className="text-xs font-bold text-gray-500 mb-3 flex items-center justify-between">
                <span>{col.name}</span>
                <span className="bg-paper-dim rounded-full px-2 py-0.5">{colTasks.length}</span>
              </div>
              <div className="space-y-2">
                {colTasks.map((t) => {
                  const docSummary = formatDocRequestSummary(t.documentRequestSummary);
                  return (
                    <div key={t.id} className="border border-line rounded-lg p-3 text-xs bg-paper/40">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <Link href={taskHref(t.id)} className="font-medium hover:text-accent hover:underline">
                          {t.title}
                        </Link>
                        {t.priority && (
                          <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[t.priority]}`}>
                            {PRIORITY_LABEL[t.priority]}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 mb-1">
                        {t.client?.name ?? "—"} · {t.categoryOption?.name ?? t.returnType}
                      </div>
                      <div className={`mb-2 ${isOverdue(t) ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "No due date"}
                        {isOverdue(t) && " · Overdue"}
                      </div>
                      {docSummary && (
                        <div className={`mb-2 ${docSummary.outstanding > 0 ? "text-amber-600" : "text-green-700"}`}>
                          {docSummary.label}
                        </div>
                      )}
                      {canReassign ? (
                        <select
                          value={t.assignee?.id ?? ""}
                          onChange={(e) => reassign(t.id, e.target.value)}
                          className="w-full border border-line rounded px-1 py-0.5 text-xs mb-2"
                          title="Reassign"
                        >
                          <option value="">Unassigned</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-gray-500 mb-2">{t.assignee?.name ?? "Unassigned"}</div>
                      )}
                      <select
                        value={getTaskColumnId(t, columns)}
                        onChange={(e) => {
                          const target = columns.find((c) => c.id === e.target.value);
                          if (target) moveTask(t.id, target);
                        }}
                        className="w-full border border-line rounded px-1 py-0.5 text-xs"
                      >
                        {columns.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {colTasks.length === 0 && <p className="text-xs text-gray-300">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
