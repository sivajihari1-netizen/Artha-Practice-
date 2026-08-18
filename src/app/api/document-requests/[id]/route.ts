import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

const updateRequestSchema = z.object({
  // null unlinks. Same shape as PATCH /api/documents/[id]'s taskId handling.
  taskId: z.string().nullable().optional(),
});

/** Lets staff link or unlink an existing DocumentRequest to/from a Task (P1 batch). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.documentRequest.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // A taskId from the browser is never trusted on its own — it must resolve
  // to a real Task in this same firm, and (DocumentRequest.clientId is never
  // nullable) that Task must belong to this exact same client.
  if (parsed.data.taskId) {
    const task = await prisma.task.findFirst({ where: { id: parsed.data.taskId, firmId: auth.session.firmId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 400 });
    if (task.clientId !== existing.clientId) {
      return NextResponse.json({ error: "Task must belong to the same client as this document request" }, { status: 400 });
    }
  }

  const request = await prisma.documentRequest.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  return NextResponse.json({ request });
}
