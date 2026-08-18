import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const statusValues = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const returnTypeValues = ["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"] as const;
const priorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(statusValues).optional(),
  statusOptionId: z.string().optional(),
  returnType: z.enum(returnTypeValues).optional(),
  categoryOptionId: z.string().optional(),
  priority: z.enum(priorityValues).nullable().optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().nullable().optional(),
});

async function resolveTaskValues(firmId: string, currentStatus: string, currentReturnType: string, statusOptionId?: string, categoryOptionId?: string, status?: (typeof statusValues)[number], returnType?: (typeof returnTypeValues)[number]) {
  const [statusOption, categoryOption] = await Promise.all([
    statusOptionId ? prisma.taskStatusOption.findFirst({ where: { id: statusOptionId, firmId } }) : null,
    categoryOptionId ? prisma.taskCategoryOption.findFirst({ where: { id: categoryOptionId, firmId } }) : null,
  ]);

  const resolvedStatus = statusOption?.systemKey && statusValues.includes(statusOption.systemKey as (typeof statusValues)[number])
    ? (statusOption.systemKey as (typeof statusValues)[number])
    : status ?? currentStatus;

  const resolvedReturnType = categoryOption?.systemKey && returnTypeValues.includes(categoryOption.systemKey as (typeof returnTypeValues)[number])
    ? (categoryOption.systemKey as (typeof returnTypeValues)[number])
    : returnType ?? currentReturnType;

  return {
    resolvedStatus,
    resolvedReturnType,
    statusOptionId: statusOption?.id ?? undefined,
    categoryOptionId: categoryOption?.id ?? undefined,
    // Firm-configured display label, for activity titles (spec Step 12) —
    // null when this update didn't resolve a custom option, so the caller
    // falls back to the raw status/returnType text.
    statusOptionName: statusOption?.name ?? null,
  };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.task.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const parsed = updateTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { dueDate, statusOptionId, categoryOptionId, status, returnType, ...rest } = parsed.data;

  // Reassignment (P1 batch): only Partner/Manager may change who a task is
  // assigned to — Staff can still see the assignee (read-only) and change
  // everything else on a task exactly as before. Only a *genuine* change is
  // gated, so a no-op PATCH (e.g. re-saving the same assigneeId) never 403s.
  const reassigning = rest.assigneeId !== undefined && rest.assigneeId !== existing.assigneeId;
  if (reassigning && auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can reassign tasks" }, { status: 403 });
  }
  // A non-null assigneeId is never trusted on its own — it must resolve to a
  // real user in this same firm. (This check pre-dates and is independent of
  // the role check above — even Partners/Managers can't assign to someone
  // outside the firm.)
  if (reassigning && rest.assigneeId) {
    const assignee = await prisma.user.findFirst({ where: { id: rest.assigneeId, firmId: auth.session.firmId } });
    if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
  }

  // Firm-configured label for the *current* status, so a status-change
  // activity can say e.g. "To Do → Partner Review" instead of the raw
  // TODO/REVIEW system keys (spec Step 12).
  const previousStatusOption = existing.statusOptionId
    ? await prisma.taskStatusOption.findUnique({ where: { id: existing.statusOptionId }, select: { name: true } })
    : null;

  const resolved = await resolveTaskValues(auth.session.firmId, existing.status, existing.returnType, statusOptionId, categoryOptionId, status, returnType);

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...rest,
      status: resolved.resolvedStatus as any,
      returnType: resolved.resolvedReturnType as any,
      statusOptionId: resolved.statusOptionId,
      categoryOptionId: resolved.categoryOptionId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    },
  });

  // Below: each kind of change gets its own, specific activity (spec Step 7)
  // rather than one generic "task updated" — so a status move and a
  // reassignment in the same PATCH both show up distinctly on the timeline,
  // without duplicating into a noisy catch-all event too.
  if (rest.assigneeId !== undefined && rest.assigneeId !== existing.assigneeId) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "TASK",
      entityId: task.id,
      eventType: ActivityEvent.TASK_ASSIGNED,
      title: `Task reassigned: ${task.title}`,
      actorId: auth.session.userId,
      metadata: { previousAssigneeId: existing.assigneeId, newAssigneeId: rest.assigneeId },
    });
  }

  // ?? null on both sides — resolveTaskValues returns undefined for "no
  // custom option resolved," while a fresh task's statusOptionId is null;
  // comparing those directly with !== always reads as "changed" even when
  // nothing did (undefined !== null), which would fire a false
  // TASK_STATUS_CHANGED on every no-op PATCH.
  const statusActuallyChanged =
    resolved.resolvedStatus !== existing.status || (resolved.statusOptionId ?? null) !== (existing.statusOptionId ?? null);
  if (statusActuallyChanged) {
    const fromLabel = previousStatusOption?.name ?? existing.status;
    const toLabel = resolved.statusOptionName ?? resolved.resolvedStatus;
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "TASK",
      entityId: task.id,
      eventType: ActivityEvent.TASK_STATUS_CHANGED,
      title: `Status changed: ${fromLabel} → ${toLabel}`,
      actorId: auth.session.userId,
      metadata: { fromSystemKey: existing.status, toSystemKey: resolved.resolvedStatus },
    });

    if (resolved.resolvedStatus === "DONE" && existing.status !== "DONE") {
      await recordActivity({
        firmId: auth.session.firmId,
        entityType: "TASK",
        entityId: task.id,
        eventType: ActivityEvent.TASK_COMPLETED,
        title: `Task completed: ${task.title}`,
        actorId: auth.session.userId,
      });
    }
  }

  const otherFieldsChanged = ["title", "description", "dueDate", "priority"].filter(
    (key) => key in parsed.data && (key === "dueDate" ? dueDate !== undefined : true)
  );
  if (otherFieldsChanged.length > 0) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "TASK",
      entityId: task.id,
      eventType: ActivityEvent.TASK_UPDATED,
      title: `Task updated: ${otherFieldsChanged.join(", ")}`,
      actorId: auth.session.userId,
      metadata: { changedFields: otherFieldsChanged },
    });
  }

  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.task.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await prisma.task.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
