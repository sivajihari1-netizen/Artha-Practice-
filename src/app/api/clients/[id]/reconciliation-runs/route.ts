import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { storeFile } from "@/lib/storage";
import { sanitizeFileName, computeChecksum, defaultRetentionExpiry } from "@/lib/documentValidation";
import { runReconciliationPipeline, PipelineError } from "@/lib/reconciliation/pipeline";
import { ExtractionError } from "@/lib/reconciliation/extract";
import type { ReconciliationType } from "@/lib/reconciliation/types";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — CSV/Excel/JSON exports, not scanned documents
const RECONCILIATION_TYPES: ReconciliationType[] = ["GST_2B_VS_PURCHASE", "GST_1_VS_SALES", "BANK_VS_BOOKS"];

function isSupportedExtension(fileName: string, allowJson: boolean): boolean {
  const name = fileName.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls") || (allowJson && name.endsWith(".json"));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const runs = await prisma.reconciliationRun.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      matchedCount: true,
      exceptionCount: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  // F2 backend authorization closure: starting a reconciliation run is a
  // financial/compliance operation — matches the same STAFF-blocked gate
  // already used for invoice/quotation/task-template creation. Checked
  // before any lookup or mutation, same order as those routes.
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can start a reconciliation run" }, { status: 403 });
  }

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const clientId = client.id;
  const firmId = auth.session.firmId;
  const userId = auth.session.userId;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const type = formData.get("type") as string | null;
  const periodStartRaw = formData.get("periodStart") as string | null;
  const periodEndRaw = formData.get("periodEnd") as string | null;
  const sourceAFile = formData.get("sourceAFile");
  const sourceBFile = formData.get("sourceBFile");

  if (!type || !RECONCILIATION_TYPES.includes(type as ReconciliationType)) {
    return NextResponse.json({ error: `type must be one of ${RECONCILIATION_TYPES.join(", ")}` }, { status: 400 });
  }
  const reconciliationType = type as ReconciliationType;

  const periodStart = periodStartRaw ? new Date(periodStartRaw) : null;
  const periodEnd = periodEndRaw ? new Date(periodEndRaw) : null;
  if (!periodStart || Number.isNaN(periodStart.getTime()) || !periodEnd || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "periodStart and periodEnd are required, as valid dates" }, { status: 400 });
  }

  if (!(sourceAFile instanceof File) || !(sourceBFile instanceof File)) {
    const aLabel = reconciliationType === "BANK_VS_BOOKS" ? "bank statement" : reconciliationType === "GST_1_VS_SALES" ? "GSTR-1 export" : "GSTR-2B export";
    return NextResponse.json({ error: `Both the ${aLabel} (sourceAFile) and the books export (sourceBFile) are required` }, { status: 400 });
  }
  if (sourceAFile.size > MAX_SIZE_BYTES || sourceBFile.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Each file must be under 10 MB" }, { status: 413 });
  }

  const allowJsonA = reconciliationType !== "BANK_VS_BOOKS";
  if (!isSupportedExtension(sourceAFile.name, allowJsonA)) {
    return NextResponse.json(
      {
        error:
          reconciliationType === "BANK_VS_BOOKS"
            ? "Bank statement must be a CSV or Excel export — PDF bank statements aren't supported yet."
            : "Expected a .csv, .xlsx, .xls, or .json file.",
      },
      { status: 400 }
    );
  }
  if (!isSupportedExtension(sourceBFile.name, false)) {
    return NextResponse.json({ error: "Books export must be a .csv, .xlsx, or .xls file." }, { status: 400 });
  }

  const [bufferA, bufferB] = await Promise.all([
    sourceAFile.arrayBuffer().then((b) => Buffer.from(b)),
    sourceBFile.arrayBuffer().then((b) => Buffer.from(b)),
  ]);
  const checksumA = computeChecksum(bufferA);
  const checksumB = computeChecksum(bufferB);

  // Idempotency (spec section 9): re-uploading the exact same pair of files for the same
  // client/type/period returns the existing run instead of re-extracting.
  const existingRun = await prisma.reconciliationRun.findFirst({
    where: {
      clientId,
      type: reconciliationType,
      periodStart,
      periodEnd,
      status: { not: "FAILED" },
      sourceADocument: { is: { checksumSha256: checksumA } },
      sourceBDocument: { is: { checksumSha256: checksumB } },
    },
  });
  if (existingRun) {
    return NextResponse.json({ run: existingRun, duplicate: true }, { status: 200 });
  }

  async function getOrCreateDocument(file: File, buffer: Buffer, checksum: string) {
    const existing = await prisma.document.findFirst({ where: { clientId, checksumSha256: checksum, status: "ACTIVE" } });
    if (existing) return existing;
    const safeName = sanitizeFileName(file.name);
    const storageKey = `${firmId}/${clientId}/reconciliation/${Date.now()}-${safeName}`;
    await storeFile(storageKey, buffer, file.type || undefined);
    return prisma.document.create({
      data: {
        firmId,
        clientId,
        category: "Reconciliation Source",
        fileName: file.name,
        storageKey,
        mimeType: file.type || null,
        sizeBytes: file.size,
        checksumSha256: checksum,
        sourceChannel: "STAFF_MANUAL_UPLOAD",
        uploadedById: userId,
        retentionExpiryDate: defaultRetentionExpiry(),
      },
    });
  }

  const [documentA, documentB] = await Promise.all([
    getOrCreateDocument(sourceAFile, bufferA, checksumA),
    getOrCreateDocument(sourceBFile, bufferB, checksumB),
  ]);

  const run = await prisma.reconciliationRun.create({
    data: {
      firmId,
      clientId,
      type: reconciliationType,
      periodStart,
      periodEnd,
      sourceADocumentId: documentA.id,
      sourceBDocumentId: documentB.id,
      createdById: auth.session.userId,
    },
  });

  await recordActivity({
    firmId,
    entityType: "RECONCILIATION",
    entityId: run.id,
    eventType: ActivityEvent.RECONCILIATION_CREATED,
    title: `Reconciliation started: ${reconciliationType.replace(/_/g, " ")} (${client.name})`,
    actorId: auth.session.userId,
    metadata: { type: reconciliationType, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
  });

  try {
    const summary = await runReconciliationPipeline({
      runId: run.id,
      firmId,
      clientId,
      type: reconciliationType,
      sourceA: { buffer: bufferA, fileName: sourceAFile.name, mimeType: sourceAFile.type || null },
      sourceB: { buffer: bufferB, fileName: sourceBFile.name, mimeType: sourceBFile.type || null },
      createdById: auth.session.userId,
    });
    const updatedRun = await prisma.reconciliationRun.findUnique({ where: { id: run.id } });

    // One summary event for the whole run, not one per exception row — a run
    // can easily produce dozens of exceptions, and per-row activity would be
    // exactly the noisy-timeline outcome the spec calls out to avoid.
    if (updatedRun && updatedRun.exceptionCount > 0) {
      await recordActivity({
        firmId,
        entityType: "RECONCILIATION",
        entityId: run.id,
        eventType: ActivityEvent.RECONCILIATION_EXCEPTION,
        title: `${updatedRun.exceptionCount} exception${updatedRun.exceptionCount === 1 ? "" : "s"} found (${client.name})`,
        actorType: "SYSTEM",
        metadata: { exceptionCount: updatedRun.exceptionCount, matchedCount: updatedRun.matchedCount },
      });
    }

    return NextResponse.json({ run: updatedRun, summary }, { status: 201 });
  } catch (err) {
    if (err instanceof PipelineError || err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message, runId: run.id }, { status: 400 });
    }
    throw err;
  }
}
