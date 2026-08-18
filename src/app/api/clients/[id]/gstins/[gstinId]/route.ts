import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; gstinId: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const gstin = await prisma.clientGstin.findFirst({ where: { id: params.gstinId, clientId: client.id } });
  if (!gstin) return NextResponse.json({ error: "GSTIN not found" }, { status: 404 });

  // Soft-deactivate only — already-generated tasks for this GSTIN are left as-is.
  await prisma.clientGstin.update({ where: { id: gstin.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
