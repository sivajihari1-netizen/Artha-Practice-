import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const createRequestSchema = z.object({
  items: z.array(z.string().min(1)).min(1, "Add at least one document to request"),
  note: z.string().optional(),
  // Explicit, staff-chosen link to the Task this request supports — same
  // reasoning as Document.taskId. Optional at creation; can also be set/
  // cleared afterward via PATCH /api/document-requests/[id].
  taskId: z.string().optional(),
});

const EXPIRY_DAYS = 14;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const requests = await prisma.documentRequest.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: { contacts: { where: { isPrimary: true }, take: 1 } },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const parsed = createRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { items, note, taskId } = parsed.data;

  const contact = client.contacts[0];
  if (!contact?.phone) {
    return NextResponse.json(
      { error: "This client has no primary contact with a phone number on file" },
      { status: 400 }
    );
  }

  // A taskId is never trusted on its own — it must resolve to a real Task in
  // this same firm, and (DocumentRequest.clientId is never nullable, unlike
  // Document) that Task must belong to this exact client.
  if (taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId, firmId: auth.session.firmId } });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 400 });
    if (task.clientId !== client.id) {
      return NextResponse.json({ error: "Task must belong to the same client as this document request" }, { status: 400 });
    }
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const request = await prisma.documentRequest.create({
    data: {
      firmId: auth.session.firmId,
      clientId: client.id,
      token,
      note,
      taskId: taskId ?? undefined,
      expiresAt,
      createdById: auth.session.userId,
      items: { create: items.map((label) => ({ label })) },
    },
    include: { items: true },
  });

  const uploadUrl = `${process.env.APP_URL ?? "https://arthapractice.in"}/upload/${token}`;
  await sendWhatsAppMessage({
    to: contact.phone,
    templateName: "document_request",
    variables: {
      client_name: client.name,
      items: items.join(", "),
      link: uploadUrl,
    },
    firmId: auth.session.firmId,
  });

  return NextResponse.json({ request, uploadUrl }, { status: 201 });
}
