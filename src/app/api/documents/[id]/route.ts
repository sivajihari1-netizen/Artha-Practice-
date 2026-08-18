import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { WORK_TYPES } from "@/lib/documentOrganize";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const updateDocumentSchema = z.object({
  category: z.string().min(1).optional(),
  workType: z.enum(WORK_TYPES).nullable().optional(),
  periodYear: z.number().int().nullable().optional(),
  periodMonth: z.number().int().min(1).max(12).nullable().optional(),
  // Explicit link to a Task this document supports — set by staff choosing
  // from a dropdown, never inferred. null unlinks.
  taskId: z.string().nullable().optional(),
});

/** Lets staff reclassify a document (e.g. one collected via a WhatsApp document request) into the year/work-type/month filing structure, and/or link it to a Task. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.document.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateDocumentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // A taskId from the browser is never trusted on its own — it must resolve
  // to a real Task in this same firm, and (when the document already
  // belongs to a client) to a Task for that same client. This is what keeps
  // the link both firm-safe and client-safe, not just firm-safe.
  if (parsed.data.taskId) {
    const task = await prisma.task.findFirst({ where: { id: parsed.data.taskId, firmId: auth.session.firmId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 400 });
    if (existing.clientId && task.clientId !== existing.clientId) {
      return NextResponse.json({ error: "Task must belong to the same client as the document" }, { status: 400 });
    }
  }

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  return NextResponse.json({ document });
}

/** Soft delete only — the row (and its file) stays retrievable for audit, just hidden from normal views. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can delete documents" }, { status: 403 });
  }

  const existing = await prisma.document.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const document = await prisma.document.update({
    where: { id: existing.id },
    data: { status: "DELETED", deletedAt: new Date() },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "document.delete",
    targetType: "Document",
    targetId: document.id,
    metadata: { fileName: document.fileName },
  });

  if (document.clientId) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "CLIENT",
      entityId: document.clientId,
      eventType: ActivityEvent.DOCUMENT_DELETED,
      title: `Document deleted: ${document.fileName}`,
      actorId: auth.session.userId,
      metadata: { documentId: document.id, fileName: document.fileName },
    });
  }

  return NextResponse.json({ ok: true });
}
