import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const patchSchema = z.object({
  action: z.enum(["resolve", "ignore"]),
  note: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const match = await prisma.reconciliationMatch.findFirst({
    where: { id: params.id, reconciliationRun: { firmId: auth.session.firmId } },
  });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (match.status !== "EXCEPTION") {
    return NextResponse.json({ error: "Only exceptions awaiting review can be resolved or ignored" }, { status: 409 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { action, note } = parsed.data;
  const newStatus = action === "resolve" ? "RESOLVED" : "IGNORED";

  const updated = await prisma.reconciliationMatch.update({
    where: { id: match.id },
    data: { status: newStatus, resolvedById: auth.session.userId, resolvedAt: new Date(), resolutionNote: note },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: `reconciliation.exception_${action}d`,
    targetType: "ReconciliationMatch",
    targetId: match.id,
    metadata: { note },
  });

  // Recorded against the parent run (Activity has no dedicated "match"
  // entity type — see the fixed ActivityEntityType list) so it lands on the
  // same per-run timeline as RECONCILIATION_CREATED/RECONCILIATION_EXCEPTION
  // rather than an orphaned, undiscoverable-by-UI entity. resolutionNote
  // stays the single source of the human explanation (spec Step 14) — it is
  // not copied into the activity, only referenced by matchId in metadata.
  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "RECONCILIATION",
    entityId: match.reconciliationRunId,
    eventType: action === "resolve" ? ActivityEvent.RECONCILIATION_RESOLVED : ActivityEvent.RECONCILIATION_IGNORED,
    title: action === "resolve" ? "Exception resolved" : "Exception ignored",
    actorId: auth.session.userId,
    metadata: { matchId: match.id, exceptionReason: match.exceptionReason, hasNote: !!note },
  });

  // Spec step 9: a run closes once every exception on it has been resolved or ignored —
  // clean MATCHED rows don't block this.
  const remainingExceptions = await prisma.reconciliationMatch.count({
    where: { reconciliationRunId: match.reconciliationRunId, status: "EXCEPTION" },
  });
  if (remainingExceptions === 0) {
    await prisma.reconciliationRun.update({ where: { id: match.reconciliationRunId }, data: { status: "CLOSED" } });
  }

  return NextResponse.json({ match: updated });
}
