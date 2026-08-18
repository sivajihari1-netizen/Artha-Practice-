import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { storeFile } from "@/lib/storage";
import { WORK_TYPES, type WorkType } from "@/lib/documentOrganize";
import { isAllowedMimeType, sanitizeFileName, computeChecksum, defaultRetentionExpiry } from "@/lib/documentValidation";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

function parseWorkType(value: string | null): WorkType | null {
  return value && (WORK_TYPES as readonly string[]).includes(value) ? (value as WorkType) : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const documents = await prisma.document.findMany({
    where: { clientId: client.id, status: "ACTIVE" },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const file = formData.get("file");
  const category = (formData.get("category") as string) || "Uncategorized";
  const workType = parseWorkType(formData.get("workType") as string | null);
  const periodYearRaw = formData.get("periodYear") as string | null;
  const periodMonthRaw = formData.get("periodMonth") as string | null;
  const periodYear = periodYearRaw ? parseInt(periodYearRaw, 10) : null;
  const periodMonth = periodMonthRaw ? parseInt(periodMonthRaw, 10) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 });
  }
  if (!isAllowedMimeType(file.type)) {
    return NextResponse.json({ error: "Unsupported file type — PDF, JPG, PNG and WEBP only" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = computeChecksum(buffer);

  const duplicate = await prisma.document.findFirst({
    where: { clientId: client.id, checksumSha256, status: "ACTIVE" },
  });
  if (duplicate) {
    return NextResponse.json({ error: "This exact file has already been uploaded for this client", document: duplicate }, { status: 409 });
  }

  const safeName = sanitizeFileName(file.name);
  const storageKey = `${auth.session.firmId}/${client.id}/${Date.now()}-${safeName}`;
  await storeFile(storageKey, buffer, file.type);

  const document = await prisma.document.create({
    data: {
      firmId: auth.session.firmId,
      clientId: client.id,
      category,
      workType,
      periodYear,
      periodMonth,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      sizeBytes: file.size,
      checksumSha256,
      sourceChannel: "STAFF_MANUAL_UPLOAD",
      uploadedById: auth.session.userId,
      retentionExpiryDate: defaultRetentionExpiry(),
    },
  });

  // Recorded against the Client, not a standalone Document entity — a
  // client's timeline is where "what happened with this client's paperwork"
  // is actually useful; there's no per-document detail surface today for a
  // DOCUMENT-typed activity to appear on.
  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "CLIENT",
    entityId: client.id,
    eventType: ActivityEvent.DOCUMENT_UPLOADED,
    title: `Document uploaded: ${document.fileName}`,
    actorId: auth.session.userId,
    metadata: { documentId: document.id, category: document.category, fileName: document.fileName },
  });

  return NextResponse.json({ document }, { status: 201 });
}
