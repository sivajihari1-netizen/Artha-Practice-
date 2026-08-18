import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { generateComplianceRuleTasks } from "@/lib/recurringTasks";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  type: z
    .enum(["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP", "COMPANY", "TRUST", "OTHER"])
    .optional(),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  turnover: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
});

async function assertOwnership(clientId: string, firmId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, firmId } });
  return client;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: {
      contacts: true,
      credentials: { select: { id: true, label: true, username: true, expiresAt: true, createdAt: true } },
      dscRecords: true,
      tasks: { orderBy: { dueDate: "asc" } },
    },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ client });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await assertOwnership(params.id, auth.session.firmId);
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data });

  const changedFields = Object.keys(parsed.data);
  if (changedFields.length > 0) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "CLIENT",
      entityId: client.id,
      eventType: ActivityEvent.CLIENT_UPDATED,
      title: `Client updated: ${changedFields.join(", ")}`,
      actorId: auth.session.userId,
      metadata: { changedFields },
    });
  }

  // An edit (e.g. entity type or GSTIN change) can newly qualify a client for
  // rules that didn't apply before — re-check, same best-effort guard as create.
  try {
    const gstins = await prisma.clientGstin.findMany({ where: { clientId: client.id, active: true } });
    await generateComplianceRuleTasks([{ ...client, gstins }]);
  } catch (err) {
    console.error("[clients.update] compliance rule task generation failed", err);
  }

  return NextResponse.json({ client });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const existing = await assertOwnership(params.id, auth.session.firmId);
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Soft delete — keeps history (tasks, documents) intact.
  await prisma.client.update({ where: { id: params.id }, data: { active: false } });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "client.delete",
    targetType: "Client",
    targetId: existing.id,
    metadata: { name: existing.name },
  });

  // Reuses CLIENT_UPDATED rather than a new event type — an archive is, at
  // the field level, the same kind of change PATCH already records. AuditLog
  // above remains the technical/security record of this action.
  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "CLIENT",
    entityId: existing.id,
    eventType: ActivityEvent.CLIENT_UPDATED,
    title: `Client archived: ${existing.name}`,
    actorId: auth.session.userId,
    metadata: { changedFields: ["active"] },
  });

  return NextResponse.json({ ok: true });
}
