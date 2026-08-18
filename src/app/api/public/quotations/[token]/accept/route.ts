import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const acceptSchema = z.object({ name: z.string().min(1, "Enter your name to accept") });

/**
 * Unauthenticated — gated by the unguessable token. Records a lightweight
 * consent (name + timestamp + IP), not a legal e-signature. Good enough to
 * let the firm know a client has agreed to proceed; formal signed copies can
 * still follow separately for engagements that need one.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { publicToken: params.token },
    include: { client: { select: { name: true } }, firm: { select: { id: true, name: true } } },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quotation.status === "ACCEPTED") return NextResponse.json({ error: "This proposal has already been accepted" }, { status: 409 });
  if (quotation.status === "DECLINED") return NextResponse.json({ error: "This proposal was declined" }, { status: 409 });

  const parsed = acceptSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const updated = await prisma.quotation.update({
    where: { id: quotation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedByName: parsed.data.name, acceptedIp: ip },
  });

  await logAudit({
    firmId: quotation.firmId,
    action: "quotation.accepted",
    targetType: "Quotation",
    targetId: quotation.id,
    metadata: { quotationNumber: quotation.quotationNumber, acceptedByName: parsed.data.name },
  });

  // actorType SYSTEM, not USER — this route is unauthenticated (gated only
  // by the unguessable token), so there is no firm User to attribute this to.
  await recordActivity({
    firmId: quotation.firmId,
    entityType: "QUOTATION",
    entityId: quotation.id,
    eventType: ActivityEvent.QUOTATION_ACCEPTED,
    title: `Quotation accepted: ${quotation.quotationNumber}`,
    actorType: "SYSTEM",
    description: `Accepted via the public proposal link, signed as "${parsed.data.name}"`,
    metadata: { quotationNumber: quotation.quotationNumber, acceptedByName: parsed.data.name },
  });

  const partners = await prisma.user.findMany({ where: { firmId: quotation.firmId, role: "PARTNER", active: true }, select: { email: true } });
  const clientLabel = quotation.client?.name ?? quotation.prospectName ?? "The prospect";
  await Promise.all(
    partners.map((p) =>
      sendEmail({
        to: p.email,
        subject: `Proposal accepted: ${quotation.quotationNumber}`,
        body: `<p><strong>${clientLabel}</strong> accepted proposal <strong>${quotation.quotationNumber}</strong> (${quotation.title}), signed as "${parsed.data.name}".</p>`,
        firmId: quotation.firmId,
      })
    )
  );

  return NextResponse.json({ ok: true, quotation: updated });
}
