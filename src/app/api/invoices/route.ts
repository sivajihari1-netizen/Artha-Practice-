import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { createInvoiceRecord, suggestGstType } from "@/lib/invoice";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive().default(1),
        rate: z.number().nonnegative(),
      })
    )
    .min(1, "Add at least one line item"),
  applyGst: z.boolean().default(false),
  gstType: z.enum(["INTRA", "INTER"]).optional(),
  gstRate: z.number().positive().default(18),
  discountType: z.enum(["PERCENT", "FLAT"]).optional(),
  discountValue: z.number().nonnegative().default(0),
  dueDate: z.string().datetime().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const invoices = await prisma.invoice.findMany({
    where: { firmId: auth.session.firmId, clientId, status: status as never },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can create invoices" }, { status: 403 });
  }

  const parsed = createInvoiceSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { clientId, items, applyGst, gstRate, discountType, discountValue, dueDate, paymentTerms, notes } = parsed.data;
  let { gstType } = parsed.data;

  const [client, firm] = await Promise.all([
    prisma.client.findFirst({ where: { id: clientId, firmId: auth.session.firmId } }),
    prisma.firm.findUnique({ where: { id: auth.session.firmId } }),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (applyGst && !gstType) {
    gstType = suggestGstType(firm?.gstin, client.gstin) ?? "INTRA";
  }

  const invoice = await createInvoiceRecord(prisma, {
    firmId: auth.session.firmId,
    clientId,
    createdById: auth.session.userId,
    items,
    applyGst,
    gstType,
    gstRate,
    discountType,
    discountValue,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    paymentTerms,
    notes,
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "invoice.create",
    targetType: "Invoice",
    targetId: invoice.id,
    metadata: { invoiceNumber: invoice.invoiceNumber, clientId, total: invoice.total },
  });

  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "INVOICE",
    entityId: invoice.id,
    eventType: ActivityEvent.INVOICE_CREATED,
    title: `Invoice created: ${invoice.invoiceNumber}`,
    actorId: auth.session.userId,
    metadata: { invoiceNumber: invoice.invoiceNumber, clientId, total: invoice.total },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
