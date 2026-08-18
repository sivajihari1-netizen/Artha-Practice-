import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { createInvoiceRecord, mapFeeItemsToInvoiceItems, suggestGstType } from "@/lib/invoice";
import { ActivityEvent, recordActivity } from "@/lib/activity";
import type { FeeItem } from "@/lib/quotationPresets";

/**
 * Quotation -> Invoice (P1 batch). Explicit, staff-initiated only — never
 * triggered from the public accept route (see the audit's §3.A: an
 * unauthenticated client click must never generate a firm's financial
 * document). Reuses createInvoiceRecord() (the same function POST
 * /api/invoices uses) for every calculation — this route only maps
 * feeItems -> line items and supplies GST defaults; it never computes a
 * total itself.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can create invoices" }, { status: 403 });
  }

  // Single firm-scoped lookup carries everything this route needs: the
  // client's own GSTIN (for the GST-type suggestion), the firm's GSTIN (for
  // the applyGst default), and whether an invoice already exists for this
  // quotation (the fast-path idempotency check) — avoids three separate
  // round-trips.
  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: {
      client: { select: { id: true, gstin: true } },
      firm: { select: { gstin: true } },
      createdInvoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });
  if (!quotation) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  // Idempotency fast path — checked FIRST, before validating the quotation's
  // *current* state. "Clicked twice" (or a retry, or the quotation being
  // declined sometime after its one invoice was already created) must always
  // return the same success, never an error, regardless of what else may
  // have changed since. This is a deliberate ordering choice: the naive
  // reading of the spec numbers status/clientId checks before this one, but
  // that would turn a stale retry into an error instead of the required
  // idempotent success.
  if (quotation.createdInvoice) {
    return NextResponse.json({ invoice: quotation.createdInvoice }, { status: 200 });
  }

  if (quotation.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Only an accepted quotation can be converted to an invoice" }, { status: 400 });
  }
  if (!quotation.clientId || !quotation.client) {
    return NextResponse.json({ error: "This quotation isn't linked to a client yet, so it can't be invoiced" }, { status: 400 });
  }

  const feeItems = quotation.feeItems as unknown as FeeItem[];
  const items = mapFeeItemsToInvoiceItems(feeItems);
  if (items.length === 0) {
    return NextResponse.json({ error: "This quotation has no fee items to invoice" }, { status: 400 });
  }

  const applyGst = !!quotation.firm.gstin;
  const gstType = applyGst ? suggestGstType(quotation.firm.gstin, quotation.client.gstin) ?? undefined : undefined;
  const clientId = quotation.clientId;

  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      const created = await createInvoiceRecord(tx, {
        firmId: auth.session.firmId,
        clientId,
        createdById: auth.session.userId,
        items,
        applyGst,
        gstType,
        gstRate: 18,
        sourceQuotationId: quotation.id,
      });

      await recordActivity({
        db: tx,
        firmId: auth.session.firmId,
        entityType: "INVOICE",
        entityId: created.id,
        eventType: ActivityEvent.INVOICE_CREATED,
        title: `Invoice created: ${created.invoiceNumber}`,
        actorId: auth.session.userId,
        metadata: { invoiceNumber: created.invoiceNumber, clientId, total: created.total, sourceQuotationId: quotation.id },
      });

      return created;
    });
  } catch (err) {
    // A genuine race: another request created the invoice between our
    // fast-path check above and this create() — the @@unique constraint on
    // sourceQuotationId is what actually closes the race; this just turns
    // that into the same idempotent success instead of a raw DB error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await prisma.invoice.findFirst({
        where: { sourceQuotationId: quotation.id },
        select: { id: true, invoiceNumber: true, status: true },
      });
      if (existing) return NextResponse.json({ invoice: existing }, { status: 200 });
    }
    throw err;
  }

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "invoice.create",
    targetType: "Invoice",
    targetEntityType: "Invoice",
    targetId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, clientId, total: invoice.total, sourceQuotationId: quotation.id },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
