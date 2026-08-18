import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity, type ActivityEventType } from "@/lib/activity";

// Fields allow empty strings — the client only ever sends a row once at
// least one field is non-empty, but which field that is varies (a firm
// might fill in a fee amount before typing the description, etc.), so
// requiring every field here would reject a perfectly normal in-progress row.
const scopeItemSchema = z.object({ title: z.string(), description: z.string() });
const feeItemSchema = z.object({ particulars: z.string(), fee: z.number().nonnegative(), frequency: z.string() });
const termItemSchema = z.object({ label: z.string(), description: z.string() });
const statHighlightSchema = z.object({ label: z.string(), value: z.string() });

const updateQuotationSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  preparedByName: z.string().optional(),
  introNote: z.string().optional(),
  statHighlights: z.array(statHighlightSchema).optional(),
  aboutPoints: z.array(scopeItemSchema).optional(),
  scopeItems: z.array(scopeItemSchema).optional(),
  feeItems: z.array(feeItemSchema).optional(),
  termsItems: z.array(termItemSchema).optional(),
  validUntil: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: { client: { select: { id: true, name: true } }, firm: true },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ quotation });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can edit quotations" }, { status: 403 });
  }

  const existing = await prisma.quotation.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateQuotationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { validUntil, status, ...rest } = parsed.data;

  const quotation = await prisma.quotation.update({
    where: { id: existing.id },
    data: {
      ...rest,
      validUntil: validUntil === undefined ? undefined : validUntil === null ? null : new Date(validUntil),
      status: status ?? existing.status,
    },
  });

  if (status && status !== existing.status) {
    await logAudit({
      firmId: auth.session.firmId,
      userId: auth.session.userId,
      action: "quotation.status_change",
      targetType: "Quotation",
      targetId: quotation.id,
      metadata: { quotationNumber: quotation.quotationNumber, from: existing.status, to: status },
    });

    // EXPIRED isn't in the given vocabulary (spec Step 17) and DRAFT is the
    // unremarkable starting state — only these three are business events.
    // ACCEPTED/DECLINED normally arrive via the public accept/decline routes
    // below, but staff can also record one manually here (e.g. a verbal
    // acceptance), so it's handled in both places.
    const eventType: ActivityEventType | null =
      status === "SENT" ? ActivityEvent.QUOTATION_SENT
      : status === "ACCEPTED" ? ActivityEvent.QUOTATION_ACCEPTED
      : status === "DECLINED" ? ActivityEvent.QUOTATION_DECLINED
      : null;
    if (eventType) {
      await recordActivity({
        firmId: auth.session.firmId,
        entityType: "QUOTATION",
        entityId: quotation.id,
        eventType,
        title: `Quotation ${status.toLowerCase()}: ${quotation.quotationNumber}`,
        actorId: auth.session.userId,
        metadata: { quotationNumber: quotation.quotationNumber, from: existing.status, to: status },
      });
    }
  }

  return NextResponse.json({ quotation });
}
