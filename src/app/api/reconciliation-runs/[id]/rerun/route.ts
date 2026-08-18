import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { rerunReconciliationMatching, PipelineError } from "@/lib/reconciliation/pipeline";

// Re-runs MATCH → CLASSIFY → EXPLAIN → ESCALATE against the already-extracted
// line items for this run — no re-upload needed. Use after a correction
// (e.g. a column mapping was fixed for this client), not as a general
// "refresh" button — see the caveats in rerunReconciliationMatching's doc
// comment (prior resolution notes are discarded).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  // F2 backend authorization closure: same STAFF-blocked gate as starting a
  // run (upload) — re-matching is the same class of financial/compliance
  // operation. Checked before any lookup or mutation.
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can re-run reconciliation matching" }, { status: 403 });
  }

  const run = await prisma.reconciliationRun.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!run) return NextResponse.json({ error: "Reconciliation run not found" }, { status: 404 });
  if (run.status === "UPLOADED" || run.status === "EXTRACTING") {
    return NextResponse.json({ error: "This run hasn't finished extracting yet" }, { status: 409 });
  }

  try {
    const summary = await rerunReconciliationMatching({ runId: run.id });
    const updatedRun = await prisma.reconciliationRun.findUnique({ where: { id: run.id } });
    return NextResponse.json({ run: updatedRun, summary });
  } catch (err) {
    if (err instanceof PipelineError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
