import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity } from "@/lib/activity";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const quotation = await prisma.quotation.findUnique({ where: { publicToken: params.token } });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quotation.status === "ACCEPTED" || quotation.status === "DECLINED") {
    return NextResponse.json({ error: "This proposal has already been responded to" }, { status: 409 });
  }

  const updated = await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status: "DECLINED", declinedAt: new Date() },
  });

  await logAudit({
    firmId: quotation.firmId,
    action: "quotation.declined",
    targetType: "Quotation",
    targetId: quotation.id,
    metadata: { quotationNumber: quotation.quotationNumber },
  });

  await recordActivity({
    firmId: quotation.firmId,
    entityType: "QUOTATION",
    entityId: quotation.id,
    eventType: ActivityEvent.QUOTATION_DECLINED,
    title: `Quotation declined: ${quotation.quotationNumber}`,
    actorType: "SYSTEM",
    description: "Declined via the public proposal link",
    metadata: { quotationNumber: quotation.quotationNumber },
  });

  return NextResponse.json({ ok: true, quotation: updated });
}
