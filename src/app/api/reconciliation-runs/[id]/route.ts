import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const run = await prisma.reconciliationRun.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: {
      client: { select: { id: true, name: true } },
      sourceADocument: { select: { id: true, fileName: true } },
      sourceBDocument: { select: { id: true, fileName: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!run) return NextResponse.json({ error: "Reconciliation run not found" }, { status: 404 });

  return NextResponse.json({ run });
}
