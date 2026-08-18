import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { deriveStateFromGstin, isValidGstinFormat } from "@/lib/gstin";
import { generateComplianceRuleTasks } from "@/lib/recurringTasks";

const createGstinSchema = z.object({
  gstin: z.string().refine(isValidGstinFormat, "Not a valid GSTIN"),
  qrmpOpted: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const parsed = createGstinSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const gstin = parsed.data.gstin.trim().toUpperCase();
  const state = deriveStateFromGstin(gstin);
  if (!state) {
    return NextResponse.json({ error: "Unrecognized GSTIN state code" }, { status: 400 });
  }

  let created;
  try {
    created = await prisma.clientGstin.create({
      data: { clientId: client.id, gstin, state, qrmpOpted: parsed.data.qrmpOpted },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "This GSTIN is already registered for this client" }, { status: 409 });
    }
    throw err;
  }

  // Fires GST-scoped rules for this specific GSTIN immediately, same
  // best-effort guard as client create/update.
  try {
    const allGstins = await prisma.clientGstin.findMany({ where: { clientId: client.id, active: true } });
    await generateComplianceRuleTasks([{ ...client, gstins: allGstins }]);
  } catch (err) {
    console.error("[clients.gstins.create] compliance rule task generation failed", err);
  }

  return NextResponse.json({ gstin: created }, { status: 201 });
}
