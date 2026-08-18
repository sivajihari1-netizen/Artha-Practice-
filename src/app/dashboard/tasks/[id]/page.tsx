import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Breadcrumb from "@/components/Breadcrumb";
import ActivityTimeline from "@/components/ActivityTimeline";
import TaskActionsBar from "@/components/TaskActionsBar";
import TaskDocumentsSection from "@/components/TaskDocumentsSection";
import { ensureFirmTaskWorkflow } from "@/lib/taskWorkflow";
import { getEntityActivityTimeline } from "@/lib/activity";
import { getTaskColumnId } from "@/lib/taskBoard";

const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "text-gray-500 bg-gray-100",
  MEDIUM: "text-blue-700 bg-blue-50",
  HIGH: "text-amber-700 bg-amber-50",
  URGENT: "text-red-700 bg-red-50",
};
// Same "coming up soon" window as the Staff workload page (src/app/dashboard/staff/page.tsx) — kept as an independent literal, same as that page's own constant, rather than a shared export used by exactly one other call site.
const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000;

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Same vocabulary as the Reconciliation Exceptions queue (src/app/dashboard/reconciliation/page.tsx) — duplicated rather than shared, matching this codebase's existing convention for small label maps (e.g. PRIORITY_LABEL above is already duplicated the same way in 3 files).
const RECONCILIATION_REASON_LABEL: Record<string, string> = {
  MISSING_IN_BOOKS: "Missing in books",
  MISSING_IN_SOURCE: "Missing in source",
  AMOUNT_MISMATCH: "Amount mismatch",
  DATE_MISMATCH: "Date mismatch",
  GSTIN_MISMATCH: "GSTIN mismatch",
  DUPLICATE: "Duplicate",
  RATE_MISMATCH: "Rate mismatch",
};

/** periodKey is "YYYY-MM" | "YYYY-QN" | "YYYY" (annual), optionally suffixed with ":<GSTIN>" — see Task.periodKey's schema comment. */
function formatPeriod(periodKey: string | null): string | null {
  if (!periodKey) return null;
  const [base] = periodKey.split(":");
  const monthMatch = base.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return `${MONTH_NAMES[Number(monthMatch[2]) - 1]} ${monthMatch[1]}`;
  const quarterMatch = base.match(/^(\d{4})-Q(\d)$/);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  return base;
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  const firmId = session!.firmId;

  // Single firm-scoped query for the task and every nested relation the page
  // renders (audit §9) — client/assignee/createdBy/statusOption/
  // categoryOption/complianceRule/sourceTemplate/documents/documentRequests
  // all come from this one findFirst, so nothing on the page can leak
  // another firm's data via a browser-supplied id. Activity is the one
  // necessary second query, because it's polymorphic (no real FK) — same
  // two-query shape the Client 360 page already uses.
  const [task, workflow, staff] = await Promise.all([
    prisma.task.findFirst({
      where: { id: params.id, firmId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            type: true,
            pan: true,
            gstin: true,
            contacts: { where: { isPrimary: true }, take: 1, select: { name: true, phone: true, email: true } },
          },
        },
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        statusOption: { select: { id: true, name: true, systemKey: true } },
        categoryOption: { select: { id: true, name: true } },
        complianceRule: { select: { id: true, ruleCode: true, title: true, recurrence: true } },
        sourceTemplate: { select: { id: true, title: true, recurrence: true } },
        documents: {
          where: { status: "ACTIVE" },
          orderBy: { uploadedAt: "desc" },
          select: { id: true, fileName: true, category: true, sizeBytes: true },
        },
        documentRequests: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, items: { select: { id: true, label: true, fulfilled: true } } },
        },
        // Reverse side of ReconciliationMatch.taskId (Batch B) — the relation
        // already existed and was already written correctly by the
        // escalation pipeline; this just selects it so the page can show it.
        reconciliationMatches: {
          select: { id: true, exceptionReason: true, riskScore: true, status: true },
        },
      },
    }),
    ensureFirmTaskWorkflow(firmId),
    prisma.user.findMany({ where: { firmId, active: true }, select: { id: true, name: true } }),
  ]);

  if (!task) notFound();

  const canReassign = session!.role !== "STAFF";

  // Assignee workload (audit §3 sidebar) — a single query scoped to just
  // this task's assignee. Deliberately NOT calling getStaffLoadForFirm here:
  // that helper fetches every Staff/Manager in the firm to produce the
  // firm-wide Staff Workload table, which would be strictly more work than
  // this page needs for the one row it actually renders.
  let assigneeWorkload: { open: number; overdue: number; dueSoon: number } | null = null;
  if (canReassign && task.assigneeId) {
    const now = Date.now();
    const openTasks = await prisma.task.findMany({
      where: { firmId, assigneeId: task.assigneeId, status: { not: "DONE" } },
      select: { dueDate: true },
    });
    assigneeWorkload = {
      open: openTasks.length,
      overdue: openTasks.filter((t) => t.dueDate && t.dueDate.getTime() < now).length,
      dueSoon: openTasks.filter((t) => t.dueDate && t.dueDate.getTime() >= now && t.dueDate.getTime() <= now + DUE_SOON_MS).length,
    };
  }

  const timeline = await getEntityActivityTimeline({ firmId, entityType: "TASK", entityId: task.id });

  const currentStatusOptionId = getTaskColumnId(task, workflow.statusOptions);
  const primaryReconciliationMatch = task.reconciliationMatches[0] ?? null;
  const provenance = task.complianceRule
    ? { kind: "Compliance rule", title: task.complianceRule.title, sub: task.complianceRule.ruleCode }
    : task.sourceTemplate
      ? { kind: "Recurring template", title: task.sourceTemplate.title, sub: task.sourceTemplate.recurrence }
      : primaryReconciliationMatch
        ? {
            kind: "Reconciliation exception",
            title: RECONCILIATION_REASON_LABEL[primaryReconciliationMatch.exceptionReason ?? ""] ?? "Reconciliation exception",
            sub: `Risk ${primaryReconciliationMatch.riskScore} · ${primaryReconciliationMatch.status}`,
          }
        : null;
  const period = formatPeriod(task.periodKey);

  return (
    <div>
      <Breadcrumb items={[{ label: "Tasks", href: "/dashboard/tasks" }, { label: task.title }]} />

      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-extrabold">{task.title}</h1>
        {task.priority && (
          <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded ${PRIORITY_COLOR[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {task.client ? (
          <Link href={`/dashboard/clients/${task.client.id}`} className="text-accent font-medium hover:underline">
            {task.client.name}
          </Link>
        ) : (
          "No client"
        )}
        {" · "}
        {task.categoryOption?.name ?? task.returnType}
        {" · "}
        {task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString("en-IN")}` : "No due date"}
      </p>

      <div className="border border-line rounded-xl bg-white p-4 mb-6">
        <TaskActionsBar
          taskId={task.id}
          statusOptions={workflow.statusOptions
            .filter((o) => o.isActive)
            .map((o) => ({ id: o.id, name: o.name, systemKey: o.systemKey }))}
          currentStatusOptionId={currentStatusOptionId}
          priority={task.priority}
          staff={staff}
          currentAssigneeId={task.assigneeId}
          canReassign={canReassign}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="border border-line rounded-xl bg-white p-5">
            <h3 className="font-bold text-sm mb-3">Why This Task Exists</h3>
            {provenance ? (
              <div className="text-sm">
                <div className="font-medium">{provenance.title}</div>
                <div className="text-xs text-gray-500">
                  {provenance.kind} · {provenance.sub}
                  {period && ` · Period: ${period}`}
                </div>
                {primaryReconciliationMatch && (
                  <Link href="/dashboard/reconciliation" className="text-xs text-accent font-medium mt-1 inline-block">
                    View in Reconciliation Exceptions →
                  </Link>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Created manually{task.createdBy ? ` by ${task.createdBy.name}` : ""} on{" "}
                {new Date(task.createdAt).toLocaleDateString("en-IN")}
                {period && ` · Period: ${period}`}
              </div>
            )}
          </div>

          <div className="border border-line rounded-xl bg-white p-5">
            <h3 className="font-bold text-sm mb-3">Documents</h3>
            <TaskDocumentsSection documents={task.documents} documentRequests={task.documentRequests} />
          </div>

          <div className="border border-line rounded-xl bg-white p-5">
            <h3 className="font-bold text-sm mb-3">Activity &amp; History</h3>
            <ActivityTimeline
              entityType="TASK"
              entityId={task.id}
              initialActivities={timeline.ok ? (timeline.activities as any) : []}
              initialNextCursor={timeline.ok ? timeline.nextCursor : null}
            />
          </div>
        </div>

        <div className="space-y-5">
          {task.client && (
            <div className="border border-line rounded-xl bg-white p-5">
              <h3 className="font-bold text-sm mb-2">Client</h3>
              <div className="text-sm font-medium">{task.client.name}</div>
              <div className="text-xs text-gray-500 mb-2">
                {task.client.type} {task.client.pan ? `· PAN ${task.client.pan}` : ""} {task.client.gstin ? `· GSTIN ${task.client.gstin}` : ""}
              </div>
              {task.client.contacts[0] && (
                <div className="text-xs text-gray-500 mb-3">
                  {task.client.contacts[0].name}
                  {task.client.contacts[0].phone ? ` · ${task.client.contacts[0].phone}` : ""}
                  {task.client.contacts[0].email ? ` · ${task.client.contacts[0].email}` : ""}
                </div>
              )}
              <Link href={`/dashboard/clients/${task.client.id}`} className="text-xs text-accent font-medium">
                View client &amp; billing →
              </Link>
            </div>
          )}

          {assigneeWorkload && task.assignee && (
            <div className="border border-line rounded-xl bg-white p-5">
              <h3 className="font-bold text-sm mb-2">Assignee Workload</h3>
              <div className="text-sm font-medium mb-1">{task.assignee.name}</div>
              <div className="text-xs text-gray-500">
                {assigneeWorkload.open} open
                {assigneeWorkload.overdue > 0 && <span className="text-red-600 font-semibold"> · {assigneeWorkload.overdue} overdue</span>}
                {assigneeWorkload.dueSoon > 0 && ` · ${assigneeWorkload.dueSoon} due soon`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
