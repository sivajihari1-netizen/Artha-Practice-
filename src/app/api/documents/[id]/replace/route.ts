import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { storeFile } from "@/lib/storage";
import { isAllowedMimeType, sanitizeFileName, computeChecksum, defaultRetentionExpiry } from "@/lib/documentValidation";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB, matches the original upload limit

/** Uploads a new version of an existing document — the old row is marked SUPERSEDED, not deleted. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await prisma.document.findFirst({ where: { id: params.id, firmId: auth.session.firmId, status: "ACTIVE" } });
  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 });
  if (!isAllowedMimeType(file.type)) {
    return NextResponse.json({ error: "Unsupported file type — PDF, JPG, PNG and WEBP only" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = computeChecksum(buffer);

  if (existing.clientId) {
    const duplicate = await prisma.document.findFirst({
      where: { clientId: existing.clientId, checksumSha256, status: "ACTIVE", id: { not: existing.id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This exact file already exists for this client", document: duplicate }, { status: 409 });
    }
  }

  const safeName = sanitizeFileName(file.name);
  const storageKey = `${auth.session.firmId}/${existing.clientId ?? "unassigned"}/${Date.now()}-${safeName}`;
  await storeFile(storageKey, buffer, file.type);

  const newDocument = await prisma.document.create({
    data: {
      firmId: existing.firmId,
      clientId: existing.clientId,
      category: existing.category,
      workType: existing.workType,
      periodYear: existing.periodYear,
      periodMonth: existing.periodMonth,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      sizeBytes: file.size,
      checksumSha256,
      version: existing.version + 1,
      sourceChannel: "STAFF_MANUAL_UPLOAD",
      uploadedById: auth.session.userId,
      retentionExpiryDate: defaultRetentionExpiry(),
    },
  });

  await prisma.document.update({
    where: { id: existing.id },
    data: { status: "SUPERSEDED", supersededById: newDocument.id },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "document.replace",
    targetType: "Document",
    targetId: newDocument.id,
    metadata: { previousDocumentId: existing.id, fileName: newDocument.fileName },
  });

  if (newDocument.clientId) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "CLIENT",
      entityId: newDocument.clientId,
      eventType: ActivityEvent.DOCUMENT_REPLACED,
      title: `Document replaced: ${newDocument.fileName}`,
      actorId: auth.session.userId,
      metadata: { previousDocumentId: existing.id, documentId: newDocument.id, fileName: newDocument.fileName },
    });
  }

  return NextResponse.json({ document: newDocument }, { status: 201 });
}
