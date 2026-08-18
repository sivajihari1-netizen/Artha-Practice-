import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { isAllowedMimeType, sanitizeFileName, computeChecksum, defaultRetentionExpiry } from "@/lib/documentValidation";

// Public, unauthenticated by design — the random token is the only access
// control. Sent to exactly one client via WhatsApp/email; never logged or
// echoed anywhere else. See DocumentRequest model comment in schema.prisma.

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB, matches the authenticated document upload limit

async function loadRequest(token: string) {
  return prisma.documentRequest.findUnique({
    where: { token },
    include: {
      client: { select: { name: true } },
      firm: { select: { name: true } },
      items: { select: { id: true, label: true, fulfilled: true } },
    },
  });
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const request = await loadRequest(params.token);
  if (!request) return NextResponse.json({ error: "Link not found or no longer valid" }, { status: 404 });

  const isExpired = request.expiresAt ? request.expiresAt.getTime() < Date.now() : false;
  if (isExpired || request.status === "EXPIRED") {
    return NextResponse.json({ error: "This upload link has expired. Ask your CA to send a new one." }, { status: 410 });
  }

  return NextResponse.json({
    firmName: request.firm.name,
    clientName: request.client.name,
    note: request.note,
    status: request.status,
    items: request.items,
  });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const request = await loadRequest(params.token);
  if (!request) return NextResponse.json({ error: "Link not found or no longer valid" }, { status: 404 });

  const isExpired = request.expiresAt ? request.expiresAt.getTime() < Date.now() : false;
  if (isExpired || request.status === "EXPIRED") {
    return NextResponse.json({ error: "This upload link has expired. Ask your CA to send a new one." }, { status: 410 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const itemId = formData.get("itemId") as string | null;
  const file = formData.get("file");

  const item = request.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ error: "Unknown document item" }, { status: 400 });
  if (item.fulfilled) return NextResponse.json({ error: "This document was already uploaded" }, { status: 409 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "File exceeds 25 MB limit" }, { status: 413 });
  if (!isAllowedMimeType(file.type)) {
    return NextResponse.json({ error: "Unsupported file type — PDF, JPG, PNG and WEBP only" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = computeChecksum(buffer);

  const duplicate = await prisma.document.findFirst({
    where: { clientId: request.clientId, checksumSha256, status: "ACTIVE" },
  });
  if (duplicate) {
    return NextResponse.json({ error: "This exact file has already been uploaded" }, { status: 409 });
  }

  const safeName = sanitizeFileName(file.name);
  const storageKey = `${request.firmId}/${request.clientId}/${Date.now()}-${safeName}`;
  await storeFile(storageKey, buffer, file.type);

  const document = await prisma.document.create({
    data: {
      firmId: request.firmId,
      clientId: request.clientId,
      category: "Client Upload (WhatsApp request)",
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      sizeBytes: file.size,
      checksumSha256,
      sourceChannel: "WHATSAPP_LINK",
      retentionExpiryDate: defaultRetentionExpiry(),
    },
  });

  await prisma.documentRequestItem.update({
    where: { id: item.id },
    data: { fulfilled: true, documentId: document.id },
  });

  const remaining = request.items.filter((i) => i.id !== item.id && !i.fulfilled).length;
  await prisma.documentRequest.update({
    where: { id: request.id },
    data: { status: remaining === 0 ? "COMPLETE" : "PARTIAL" },
  });

  return NextResponse.json({ ok: true, remaining });
}
