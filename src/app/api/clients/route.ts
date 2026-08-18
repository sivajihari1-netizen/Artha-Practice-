import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { generateComplianceRuleTasks } from "@/lib/recurringTasks";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const createClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  type: z
    .enum(["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP", "COMPANY", "TRUST", "OTHER"])
    .default("INDIVIDUAL"),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  turnover: z.number().nonnegative().optional(),
});

export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const clients = await prisma.client.findMany({
    where: { firmId: auth.session.firmId, active: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true, documents: { where: { status: "ACTIVE" } } } } },
  });
  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: { ...parsed.data, firmId: auth.session.firmId },
  });

  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "CLIENT",
    entityId: client.id,
    eventType: ActivityEvent.CLIENT_CREATED,
    title: `Client created: ${client.name}`,
    actorId: auth.session.userId,
    metadata: { type: client.type },
  });

  // Best-effort: a brand new client has no ClientGstin rows yet, so this only
  // fires non-GSTIN-scoped rules (e.g. ITR/ROC by entity type). Never let a
  // rule-engine hiccup block client creation itself.
  try {
    await generateComplianceRuleTasks([{ ...client, gstins: [] }]);
  } catch (err) {
    console.error("[clients.create] compliance rule task generation failed", err);
  }

  return NextResponse.json({ client }, { status: 201 });
}
