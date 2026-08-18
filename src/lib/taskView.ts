import type { Role } from "@prisma/client";

export type TaskView = "mine" | "all";

/**
 * "My Work" vs "All Tasks" default (IA finalization, Step 4) — pulled out of
 * src/app/dashboard/tasks/page.tsx so the role-based default is testable
 * without rendering the page. An explicit, valid `requested` value always
 * wins; only an absent/invalid one falls back to the role default.
 */
export function resolveTaskView(requested: string | undefined, role: Role): TaskView {
  if (requested === "mine" || requested === "all") return requested;
  return role === "STAFF" ? "mine" : "all";
}
