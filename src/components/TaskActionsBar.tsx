"use client";

import { useRouter } from "next/navigation";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
type WorkflowOption = { id: string; name: string; systemKey: string | null };
type StaffOption = { id: string; name: string };

const PRIORITY_OPTIONS: Exclude<Priority, null>[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

/**
 * Task 360's own quick-actions strip — same PATCH /api/tasks/[id] endpoint
 * and payload shapes KanbanBoard already uses (statusOptionId+status,
 * priority, assigneeId); no parallel mutation route. A different shape from
 * KanbanBoard's per-card controls because this is a single full-width header
 * strip, not a card, but the actions and their authorization are identical —
 * the PATCH route's own reassignment role check (see src/app/api/tasks/[id]/route.ts)
 * is what actually enforces `canReassign`, this prop only hides the control.
 */
export default function TaskActionsBar({
  taskId,
  statusOptions,
  currentStatusOptionId,
  priority,
  staff,
  currentAssigneeId,
  canReassign,
}: {
  taskId: string;
  statusOptions: WorkflowOption[];
  currentStatusOptionId: string;
  priority: Priority;
  staff: StaffOption[];
  currentAssigneeId: string | null;
  canReassign: boolean;
}) {
  const router = useRouter();

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not update the task");
    }
  }

  async function changeStatus(statusOptionId: string) {
    const target = statusOptions.find((o) => o.id === statusOptionId);
    await patch({ statusOptionId, status: target?.systemKey ?? undefined });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 font-medium">Status</span>
        <select
          value={currentStatusOptionId}
          onChange={(e) => changeStatus(e.target.value)}
          className="border border-line rounded px-2 py-1"
        >
          {statusOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 font-medium">Priority</span>
        <select
          value={priority ?? ""}
          onChange={(e) => patch({ priority: e.target.value || null })}
          className="border border-line rounded px-2 py-1"
        >
          <option value="">None</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-gray-500 font-medium">Assignee</span>
        {canReassign ? (
          <select
            value={currentAssigneeId ?? ""}
            onChange={(e) => patch({ assigneeId: e.target.value || null })}
            className="border border-line rounded px-2 py-1"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-charcoal font-medium">
            {staff.find((s) => s.id === currentAssigneeId)?.name ?? "Unassigned"}
          </span>
        )}
      </label>
    </div>
  );
}
