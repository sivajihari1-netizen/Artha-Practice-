import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

const workflowOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  key: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  color: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const updateWorkflowSchema = z.object({
  statuses: z.array(workflowOptionSchema).optional(),
  categories: z.array(workflowOptionSchema).optional(),
});

export async function PUT(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can edit task workflow" }, { status: 403 });
  }

  const parsed = updateWorkflowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { statuses = [], categories = [] } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const existingStatusIds = new Set((await tx.taskStatusOption.findMany({ where: { firmId: auth.session.firmId }, select: { id: true } })).map((option) => option.id));
      const existingCategoryIds = new Set((await tx.taskCategoryOption.findMany({ where: { firmId: auth.session.firmId }, select: { id: true } })).map((option) => option.id));

      for (const option of statuses) {
        if (!option.name.trim() || !option.key.trim()) {
          throw new Error("Status labels must be non-empty");
        }
        if (!option.id) {
          // No id => a new status option added via "+ Add status" (previously
          // silently skipped; that was the exact gap this batch closes).
          await tx.taskStatusOption.create({
            data: {
              firmId: auth.session.firmId,
              name: option.name.trim(),
              key: option.key.trim(),
              description: option.description ?? null,
              sortOrder: option.sortOrder ?? 0,
              color: option.color ?? null,
              isActive: option.isActive ?? true,
              isDefault: false,
            },
          });
          continue;
        }
        if (!existingStatusIds.has(option.id)) {
          throw new Error("Invalid status option id");
        }
        await tx.taskStatusOption.update({
          where: { id: option.id },
          data: {
            name: option.name.trim(),
            key: option.key.trim(),
            description: option.description ?? null,
            sortOrder: option.sortOrder ?? 0,
            color: option.color ?? null,
            isActive: option.isActive ?? true,
            isDefault: option.isDefault ?? false,
          },
        });
      }

      for (const option of categories) {
        if (!option.name.trim() || !option.key.trim()) {
          throw new Error("Category labels must be non-empty");
        }
        if (!option.id) {
          await tx.taskCategoryOption.create({
            data: {
              firmId: auth.session.firmId,
              name: option.name.trim(),
              key: option.key.trim(),
              description: option.description ?? null,
              sortOrder: option.sortOrder ?? 0,
              color: option.color ?? null,
              isActive: option.isActive ?? true,
              isDefault: false,
            },
          });
          continue;
        }
        if (!existingCategoryIds.has(option.id)) {
          throw new Error("Invalid category option id");
        }
        await tx.taskCategoryOption.update({
          where: { id: option.id },
          data: {
            name: option.name.trim(),
            key: option.key.trim(),
            description: option.description ?? null,
            sortOrder: option.sortOrder ?? 0,
            color: option.color ?? null,
            isActive: option.isActive ?? true,
            isDefault: option.isDefault ?? false,
          } as any,
        });
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "A status or category with this key already exists in your firm" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can edit task workflow" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  if ((type !== "status" && type !== "category") || !id) {
    return NextResponse.json({ error: "A valid type (status|category) and id are required" }, { status: 400 });
  }

  if (type === "status") {
    const option = await prisma.taskStatusOption.findFirst({
      where: { id, firmId: auth.session.firmId },
      include: { _count: { select: { tasks: true } } },
    });
    if (!option) {
      return NextResponse.json({ error: "Status option not found" }, { status: 404 });
    }
    if (option.isDefault) {
      return NextResponse.json({ error: "The default system statuses can't be deleted — deactivate instead" }, { status: 400 });
    }
    if (option._count.tasks > 0) {
      return NextResponse.json(
        { error: `Can't delete: ${option._count.tasks} task(s) still use this status. Deactivate it instead.` },
        { status: 400 }
      );
    }
    await prisma.taskStatusOption.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  const option = await prisma.taskCategoryOption.findFirst({
    where: { id, firmId: auth.session.firmId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!option) {
    return NextResponse.json({ error: "Category option not found" }, { status: 404 });
  }
  if (option.isDefault) {
    return NextResponse.json({ error: "The default system categories can't be deleted — deactivate instead" }, { status: 400 });
  }
  if (option._count.tasks > 0) {
    return NextResponse.json(
      { error: `Can't delete: ${option._count.tasks} task(s) still use this category. Deactivate it instead.` },
      { status: 400 }
    );
  }
  await prisma.taskCategoryOption.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
