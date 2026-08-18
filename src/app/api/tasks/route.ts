import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const returnTypeValues = ["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"] as const;
const statusValues = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
const priorityValues = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  returnType: z.enum(returnTypeValues).default("OTHER"),
  categoryOptionId: z.string().optional(),
  status: z.enum(statusValues).default("TODO"),
  statusOptionId: z.string().optional(),
  priority: z.enum(priorityValues).nullable().optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
});

async function resolveStatusAndCategory(firmId: string, statusOptionId?: string, categoryOptionId?: string, status?: (typeof statusValues)[number], returnType?: (typeof returnTypeValues)[number]) {
  const [statusOption, categoryOption] = await Promise.all([
    statusOptionId ? prisma.taskStatusOption.findFirst({ where: { id: statusOptionId, firmId } }) : null,
    categoryOptionId ? prisma.taskCategoryOption.findFirst({ where: { id: categoryOptionId, firmId } }) : null,
  ]);

  const resolvedStatus = statusOption?.systemKey && statusValues.includes(statusOption.systemKey as (typeof statusValues)[number])
    ? (statusOption.systemKey as (typeof statusValues)[number])
    : status ?? "TODO";

  const resolvedReturnType = categoryOption?.systemKey && returnTypeValues.includes(categoryOption.systemKey as (typeof returnTypeValues)[number])
    ? (categoryOption.systemKey as (typeof returnTypeValues)[number])
    : returnType ?? "OTHER";

  return {
    resolvedStatus,
    resolvedReturnType,
    statusOptionId: statusOption?.id ?? undefined,
    categoryOptionId: categoryOption?.id ?? undefined,
    // Firm-configured display labels (spec Step 12: activity text must use
    // these, not the raw TODO/IN_PROGRESS/REVIEW/DONE system keys) — null
    // when no custom option was resolved, so the caller can fall back to the
    // legacy enum value for its title text.
    statusOptionName: statusOption?.name ?? null,
    categoryOptionName: categoryOption?.name ?? null,
  };
}

export async function GET(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") ?? undefined;
  const assigneeId = searchParams.get("assigneeId") ?? undefined;

  const tasks = await prisma.task.findMany({
    where: { firmId: auth.session.firmId, clientId, assigneeId },
    include: {
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      statusOption: { select: { id: true, name: true, systemKey: true } },
      categoryOption: { select: { id: true, name: true, systemKey: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const parsed = createTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { dueDate, statusOptionId, categoryOptionId, status, returnType, ...rest } = parsed.data;

  const resolved = await resolveStatusAndCategory(auth.session.firmId, statusOptionId, categoryOptionId, status, returnType);

  const task = await prisma.task.create({
    data: {
      ...rest,
      returnType: resolved.resolvedReturnType as any,
      status: resolved.resolvedStatus as any,
      statusOptionId: resolved.statusOptionId,
      categoryOptionId: resolved.categoryOptionId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      firmId: auth.session.firmId,
      createdById: auth.session.userId,
    },
  });

  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "TASK",
    entityId: task.id,
    eventType: ActivityEvent.TASK_CREATED,
    title: `Task created: ${task.title}`,
    actorId: auth.session.userId,
    metadata: {
      status: resolved.statusOptionName ?? resolved.resolvedStatus,
      category: resolved.categoryOptionName ?? resolved.resolvedReturnType,
      assigneeId: task.assigneeId ?? null,
      clientId: task.clientId ?? null,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
