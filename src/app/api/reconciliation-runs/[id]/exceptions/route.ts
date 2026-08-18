import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const run = await prisma.reconciliationRun.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!run) return NextResponse.json({ error: "Reconciliation run not found" }, { status: 404 });

  const url = req.nextUrl;
  const status = url.searchParams.get("status"); // MATCHED | EXCEPTION | RESOLVED | IGNORED
  const reason = url.searchParams.get("reason"); // e.g. AMOUNT_MISMATCH
  const minRisk = url.searchParams.get("minRisk");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  const where: Prisma.ReconciliationMatchWhereInput = { reconciliationRunId: run.id };
  if (status) where.status = status as Prisma.ReconciliationMatchWhereInput["status"];
  if (reason) where.exceptionReason = reason as Prisma.ReconciliationMatchWhereInput["exceptionReason"];
  if (minRisk) where.riskScore = { gte: parseInt(minRisk, 10) || 0 };

  const [matches, total] = await Promise.all([
    prisma.reconciliationMatch.findMany({
      where,
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        lineItemA: { select: { referenceNo: true, counterparty: true, amount: true, date: true, gstin: true } },
        lineItemB: { select: { referenceNo: true, counterparty: true, amount: true, date: true, gstin: true } },
        task: { select: { id: true, status: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.reconciliationMatch.count({ where }),
  ]);

  return NextResponse.json({ matches, total, page, pageSize: PAGE_SIZE });
}
