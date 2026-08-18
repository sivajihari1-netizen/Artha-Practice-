import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { generateQuotationNumber } from "@/lib/quotation";
import { generatePublicToken } from "@/lib/invoice";
import { QUOTATION_SERVICE_TYPES, getQuotationPreset } from "@/lib/quotationPresets";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const createQuotationSchema = z
  .object({
    clientId: z.string().optional(),
    prospectName: z.string().optional(),
    prospectEmail: z.string().email().optional().or(z.literal("")),
    prospectPhone: z.string().optional(),
    serviceType: z.enum(QUOTATION_SERVICE_TYPES),
  })
  .refine((data) => data.clientId || data.prospectName, {
    message: "Select an existing client or enter a prospect name",
    path: ["clientId"],
  });

export async function GET(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") ?? undefined;

  const quotations = await prisma.quotation.findMany({
    where: { firmId: auth.session.firmId, clientId },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ quotations });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can create quotations" }, { status: 403 });
  }

  const parsed = createQuotationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { clientId, prospectName, prospectEmail, prospectPhone, serviceType } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, firmId: auth.session.firmId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const [preparer, quotationNumber] = await Promise.all([
    prisma.user.findUnique({ where: { id: auth.session.userId }, select: { name: true } }),
    generateQuotationNumber(auth.session.firmId),
  ]);
  const preset = getQuotationPreset(serviceType);

  const quotation = await prisma.quotation.create({
    data: {
      firmId: auth.session.firmId,
      clientId: clientId || undefined,
      prospectName: clientId ? undefined : prospectName,
      prospectEmail: clientId ? undefined : prospectEmail || undefined,
      prospectPhone: clientId ? undefined : prospectPhone || undefined,
      quotationNumber,
      publicToken: generatePublicToken(),
      serviceType,
      title: preset.title,
      subtitle: preset.subtitle,
      preparedByName: preparer?.name,
      statHighlights: preset.statHighlights,
      aboutPoints: preset.aboutPoints,
      scopeItems: preset.scopeItems,
      feeItems: preset.feeItems,
      termsItems: preset.termsItems,
      createdById: auth.session.userId,
    },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "quotation.create",
    targetType: "Quotation",
    targetId: quotation.id,
    metadata: { quotationNumber: quotation.quotationNumber, serviceType },
  });

  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "QUOTATION",
    entityId: quotation.id,
    eventType: ActivityEvent.QUOTATION_CREATED,
    title: `Quotation created: ${quotation.quotationNumber}`,
    actorId: auth.session.userId,
    metadata: { quotationNumber: quotation.quotationNumber, serviceType, clientId: clientId || null },
  });

  return NextResponse.json({ quotation }, { status: 201 });
}
