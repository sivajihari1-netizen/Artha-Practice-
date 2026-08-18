import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const reconciliation = await prisma.gstReconciliation.findFirst({
    where: { id: params.id, client: { firmId: auth.session.firmId } },
    include: {
      client: { select: { id: true, name: true } },
      items: { orderBy: [{ status: "asc" }, { invoiceNumber: "asc" }] },
    },
  });
  if (!reconciliation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ reconciliation });
}
