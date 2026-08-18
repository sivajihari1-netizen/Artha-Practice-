import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { saveColumnMapping } from "@/lib/reconciliation/columnMapping";

const SOURCE_TYPES = ["purchase_register", "sales_register", "bank_ledger", "gstr2b", "gstr1"] as const;
const NORMALIZED_FIELDS = ["gstin", "referenceNo", "date", "amount", "taxAmount", "counterparty", "direction", "debitAmount", "creditAmount"] as const;

const patchSchema = z.object({
  sourceType: z.enum(SOURCE_TYPES),
  mapping: z.record(z.enum(NORMALIZED_FIELDS), z.string()),
});

// GET /column-mappings — every stored mapping for this client (spec section 8, generalized
// beyond a single sourceType so staff can review everything remembered for a client at once).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const mappings = await prisma.reconciliationColumnMapping.findMany({ where: { clientId: client.id } });
  return NextResponse.json({ mappings });
}

// PATCH /column-mappings — confirm/correct the mapping for one sourceType (spec section 4a: staff
// confirms once, then every future upload from this client reuses it without re-mapping).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const saved = await saveColumnMapping(client.id, parsed.data.sourceType, parsed.data.mapping);
  return NextResponse.json({ mapping: saved });
}
