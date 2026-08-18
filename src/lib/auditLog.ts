import { Prisma, AuditTargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Records a sensitive action for later review (credential reveals, deletions,
 * role changes, invoice status changes). Append-only — never update/delete
 * entries. Best-effort: a logging failure should never break the action it's
 * describing, so callers fire-and-forget this rather than awaiting+throwing.
 */
export async function logAudit(params: {
  firmId: string;
  userId?: string | null;
  action: string;
  targetType?: string;
  /**
   * Typed sibling of `targetType` (see the enum's schema comment) — optional
   * and independent of it. Existing call sites weren't swept to add this when
   * it was introduced; set it on new call sites so future "audit history for
   * this <entity>" queries can filter on it without a string match.
   */
  targetEntityType?: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        firmId: params.firmId,
        userId: params.userId ?? undefined,
        action: params.action,
        targetType: params.targetType,
        targetEntityType: params.targetEntityType,
        targetId: params.targetId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[auditLog] failed to record", params.action, err);
  }
}
