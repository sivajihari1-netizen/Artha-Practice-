import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { computeInvoiceTotals } from "@/lib/invoice";
import { ActivityEvent, recordActivity, type ActivityEventType } from "@/lib/activity";

const updateInvoiceSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  paymentRef: z.string().optional(),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  items: z
    .array(z.object({ description: z.string().min(1), quantity: z.number().positive(), rate: z.number().nonnegative() }))
    .optional(),
  applyGst: z.boolean().optional(),
  gstType: z.enum(["INTRA", "INTER"]).optional(),
  gstRate: z.number().positive().optional(),
  discountType: z.enum(["PERCENT", "FLAT"]).optional(),
  discountValue: z.number().nonnegative().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: {
      items: true,
      client: { select: { id: true, name: true, gstin: true, pan: true, type: true } },
      firm: { select: { name: true, gstin: true, pan: true, address: true, city: true, phone: true, email: true, website: true, bankName: true, bankAccountName: true, bankAccountNo: true, bankIfsc: true, upiId: true, showCaTagline: true, brandColor: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can edit invoices" }, { status: 403 });
  }

  const existing = await prisma.invoice.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateInvoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { status, paymentRef, notes, paymentTerms, items, applyGst, gstType, gstRate, discountType, discountValue } = parsed.data;

  if (items && existing.status !== "DRAFT") {
    return NextResponse.json({ error: "Line items can only be edited while the invoice is a draft" }, { status: 400 });
  }

  // Only these three status transitions have a business-activity meaning
  // (spec Step 16's given vocabulary) — DRAFT and OVERDUE aren't user
  // actions worth their own event (OVERDUE is cron-driven, DRAFT is the
  // unremarkable starting state).
  const statusActivityEvent: ActivityEventType | null =
    status === "SENT" ? ActivityEvent.INVOICE_SENT
    : status === "PAID" ? ActivityEvent.INVOICE_PAID
    : status === "CANCELLED" ? ActivityEvent.INVOICE_CANCELLED
    : null;
  const statusChanged = !!status && status !== existing.status;

  const invoice = await prisma.$transaction(async (tx) => {
    let updated;
    if (items) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: existing.id } });
      const nextApplyGst = applyGst ?? existing.applyGst;
      const nextGstRate = gstRate ?? existing.gstRate;
      const nextDiscountType = discountType ?? (existing.discountType as "PERCENT" | "FLAT" | null);
      const nextDiscountValue = discountValue ?? existing.discountValue;
      const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(
        items, nextApplyGst, nextGstRate, nextDiscountType, nextDiscountValue
      );
      updated = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          applyGst: nextApplyGst,
          gstType: nextApplyGst ? gstType ?? existing.gstType : null,
          gstRate: nextGstRate,
          discountType: discountAmount > 0 ? nextDiscountType : null,
          discountValue: discountAmount > 0 ? nextDiscountValue : 0,
          discountAmount,
          subtotal,
          taxAmount,
          total,
          notes: notes ?? existing.notes,
          paymentTerms: paymentTerms ?? existing.paymentTerms,
          status: status ?? existing.status,
          items: { create: items.map((i) => ({ description: i.description, quantity: i.quantity, rate: i.rate, amount: i.quantity * i.rate })) },
        },
        include: { items: true },
      });
    } else {
      updated = await tx.invoice.update({
        where: { id: existing.id },
        data: {
          status: status ?? existing.status,
          paymentRef: paymentRef ?? existing.paymentRef,
          notes: notes ?? existing.notes,
          paymentTerms: paymentTerms ?? existing.paymentTerms,
          paidAt: status === "PAID" && existing.status !== "PAID" ? new Date() : existing.paidAt,
        },
        include: { items: true },
      });
    }

    if (statusChanged && statusActivityEvent) {
      await recordActivity({
        db: tx,
        firmId: auth.session.firmId,
        entityType: "INVOICE",
        entityId: updated.id,
        eventType: statusActivityEvent,
        title: `Invoice ${status!.toLowerCase()}: ${updated.invoiceNumber}`,
        actorId: auth.session.userId,
        metadata: { from: existing.status, to: status },
      });
    }

    return updated;
  });

  if (status && status !== existing.status) {
    await logAudit({
      firmId: auth.session.firmId,
      userId: auth.session.userId,
      action: "invoice.status_change",
      targetType: "Invoice",
      targetId: invoice.id,
      metadata: { invoiceNumber: invoice.invoiceNumber, from: existing.status, to: status },
    });
  }

  return NextResponse.json({ invoice });
}
