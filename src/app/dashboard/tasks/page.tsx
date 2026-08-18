import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";
import AddTaskForm from "@/components/AddTaskForm";
import { ensureFirmTaskWorkflow } from "@/lib/taskWorkflow";
import { resolveTaskView } from "@/lib/taskView";

// "My Work" vs "All Tasks" (IA finalization, Step 4): answers "what do I need
// to work on?" immediately without a new module — same Tasks page, same
// KanbanBoard, just a narrower `where` clause. See src/lib/taskView.ts for
// the role-default logic. The toggle is available to everyone regardless of
// role — a Partner may want their own slice too, and Staff may want the full
// picture — this is a default, not a restriction (nothing here is a security
// boundary, per the audit's own principle).
export default async function TasksPage({ searchParams }: { searchParams: { view?: string; overdue?: string } }) {
  const session = getSession();
  const firmId = session!.firmId;
  const view = resolveTaskView(searchParams.view, session!.role);
  // Minimal filter affordance (Batch B) — lets the Dashboard Overview's
  // "Overdue Tasks" stat card link somewhere real. No existing overdue
  // filter was found anywhere on this page before this addition.
  const overdueOnly = searchParams.overdue === "true";

  const workflow = await ensureFirmTaskWorkflow(firmId);

  const [tasks, clients, staff] = await Promise.all([
    prisma.task.findMany({
      where: {
        firmId,
        ...(view === "mine" ? { assigneeId: session!.userId } : {}),
        ...(overdueOnly ? { status: { not: "DONE" }, dueDate: { lt: new Date() } } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        statusOption: { select: { id: true, name: true, systemKey: true, color: true } },
        categoryOption: { select: { id: true, name: true, systemKey: true } },
        // Document -> Task blocking indicator (P1 batch, informational only —
        // never drives status). A task can have more than one linked
        // request; aggregate across all of them below.
        documentRequests: { select: { items: { select: { fulfilled: true } } } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.client.findMany({ where: { firmId, active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { firmId, active: true }, select: { id: true, name: true } }),
  ]);

  const tasksWithDocSummary = tasks.map((t) => {
    const allItems = t.documentRequests.flatMap((r) => r.items);
    const documentRequestSummary = allItems.length > 0 ? { total: allItems.length, fulfilled: allItems.filter((i) => i.fulfilled).length } : null;
    return { ...t, documentRequestSummary };
  });

  const canReassign = session!.role !== "STAFF";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Tasks</h1>
          <p className="text-sm text-gray-500">
            {tasks.length} {view === "mine" ? "assigned to you" : "total"}{overdueOnly ? " · overdue" : ""} ·{" "}
            <Link href="/dashboard/tasks/templates" className="text-accent font-medium">
              Manage recurring templates
            </Link>
          </p>
        </div>
        <AddTaskForm clients={clients} staff={staff} statusOptions={workflow.statusOptions} categoryOptions={workflow.categoryOptions} />
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/dashboard/tasks?view=mine"
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
            view === "mine" ? "bg-ink text-white border-ink" : "border-line text-gray-600 hover:bg-paper-dim"
          }`}
        >
          My Work
        </Link>
        <Link
          href="/dashboard/tasks?view=all"
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
            view === "all" ? "bg-ink text-white border-ink" : "border-line text-gray-600 hover:bg-paper-dim"
          }`}
        >
          All Tasks
        </Link>
        <Link
          href={overdueOnly ? `/dashboard/tasks?view=${view}` : `/dashboard/tasks?view=${view}&overdue=true`}
          className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
            overdueOnly ? "bg-red-600 text-white border-red-600" : "border-line text-gray-600 hover:bg-paper-dim"
          }`}
        >
          {overdueOnly ? "Overdue only ✕" : "Overdue only"}
        </Link>
      </div>

      <KanbanBoard tasks={tasksWithDocSummary as any} statusOptions={workflow.statusOptions} staff={staff} canReassign={canReassign} />
    </div>
  );
}
