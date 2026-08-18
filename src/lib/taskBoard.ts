type WorkflowOption = { id: string; systemKey: string | null };

/**
 * A task's board column is keyed by statusOptionId when set, falling back to
 * the legacy status enum otherwise. A move must always send statusOptionId
 * alongside status — sending status alone leaves a task's (still-set)
 * statusOptionId pointing at its old column, and since grouping prefers
 * statusOptionId, the card never visually moves even though its status did
 * change in the DB.
 */
export function getTaskColumnId(
  task: { status: string; statusOption: { id: string } | null },
  columns: WorkflowOption[]
): string {
  if (task.statusOption) return task.statusOption.id;
  return columns.find((c) => c.systemKey === task.status)?.id ?? "";
}

/**
 * Sort weight for Task.priority — lower sorts first. null (no priority set)
 * sorts last, after LOW, so an unprioritized task never outranks one a
 * human explicitly marked as low priority.
 */
export function priorityRank(priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null): number {
  switch (priority) {
    case "URGENT": return 0;
    case "HIGH": return 1;
    case "MEDIUM": return 2;
    case "LOW": return 3;
    default: return 4;
  }
}

/**
 * Single source of truth for the Task 360 URL (Task 360 Phase 1/2) — every
 * task reference in the app should build its link through this function
 * rather than constructing "/dashboard/tasks/..." inline, so the six+
 * render sites can never drift from the one canonical route.
 */
export function taskHref(taskId: string): string {
  return `/dashboard/tasks/${taskId}`;
}

/**
 * Informational only (P1 batch, Document -> Task blocking) — never implies
 * or drives a status change. Returns null when there's nothing to show: no
 * DocumentRequest linked, or a linked one with zero items.
 */
export function formatDocRequestSummary(
  summary: { total: number; fulfilled: number } | null
): { outstanding: number; label: string } | null {
  if (!summary || summary.total === 0) return null;
  const outstanding = summary.total - summary.fulfilled;
  if (outstanding === 0) return { outstanding: 0, label: "✓ All requested documents received" };
  return { outstanding, label: `${summary.fulfilled}/${summary.total} documents received · ${outstanding} outstanding` };
}
