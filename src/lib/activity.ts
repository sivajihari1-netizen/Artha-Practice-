// Universal Firm Memory: the single write/read surface for the Activity
// table (see prisma/schema.prisma's "Universal Firm Memory" section for the
// model and why it's separate from AuditLog). No other module should call
// prisma.activity.* directly — everything goes through recordActivity() so
// the firm/actor/immutability rules stay in one place.
import type { Prisma, ActivityActorType, ActivityEntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Fixed initial vocabulary (spec Step 7). Deliberately a plain string union,
// not a Prisma enum — the DB column (Activity.eventType) is a String so new
// event types are a code change, not a migration, while this union still
// gives call sites compile-time safety against typos.
export const ActivityEvent = {
  CLIENT_CREATED: "CLIENT_CREATED",
  CLIENT_UPDATED: "CLIENT_UPDATED",
  TASK_CREATED: "TASK_CREATED",
  TASK_UPDATED: "TASK_UPDATED",
  TASK_ASSIGNED: "TASK_ASSIGNED",
  TASK_STATUS_CHANGED: "TASK_STATUS_CHANGED",
  TASK_COMPLETED: "TASK_COMPLETED",
  LEAD_CREATED: "LEAD_CREATED",
  LEAD_UPDATED: "LEAD_UPDATED",
  LEAD_STAGE_CHANGED: "LEAD_STAGE_CHANGED",
  LEAD_CONVERTED: "LEAD_CONVERTED",
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  DOCUMENT_REPLACED: "DOCUMENT_REPLACED",
  DOCUMENT_DELETED: "DOCUMENT_DELETED",
  INVOICE_CREATED: "INVOICE_CREATED",
  INVOICE_SENT: "INVOICE_SENT",
  INVOICE_PAID: "INVOICE_PAID",
  INVOICE_CANCELLED: "INVOICE_CANCELLED",
  QUOTATION_CREATED: "QUOTATION_CREATED",
  QUOTATION_SENT: "QUOTATION_SENT",
  QUOTATION_ACCEPTED: "QUOTATION_ACCEPTED",
  QUOTATION_DECLINED: "QUOTATION_DECLINED",
  RECONCILIATION_CREATED: "RECONCILIATION_CREATED",
  RECONCILIATION_EXCEPTION: "RECONCILIATION_EXCEPTION",
  RECONCILIATION_RESOLVED: "RECONCILIATION_RESOLVED",
  RECONCILIATION_IGNORED: "RECONCILIATION_IGNORED",
  STAFF_CREATED: "STAFF_CREATED",
  STAFF_UPDATED: "STAFF_UPDATED",
  // Not in the spec's initial vocabulary — added because Step 19 explicitly
  // invites a Firm event where a genuine firm-level operation exists, and
  // src/app/api/firm/route.ts's settings PATCH (bank details, GSTIN,
  // Razorpay connection, branding) clearly is one.
  FIRM_UPDATED: "FIRM_UPDATED",
} as const;
export type ActivityEventType = (typeof ActivityEvent)[keyof typeof ActivityEvent];

type Db = typeof prisma | Prisma.TransactionClient;

export type RecordActivityParams = {
  /** Pass the active `tx` here to participate in an existing transaction (see the Lead conversion route). Omit for the common, standalone case. */
  db?: Db;
  firmId: string;
  entityType: ActivityEntityType;
  entityId: string;
  eventType: ActivityEventType;
  title: string;
  description?: string;
  /** Defaults to USER. SYSTEM covers non-staff-initiated events (e.g. a client accepting a quotation via a public link). AI is future-facing only — nothing sets it yet. */
  actorType?: ActivityActorType;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records one immutable business-context event. There is deliberately no
 * update/delete counterpart — activities are historical and are never
 * expected to change after the fact (spec Step 6).
 *
 * Callers are trusted to have already firm-scoped and ownership-checked the
 * entity (every route below only calls this after its own existing
 * `findFirst({ id, firmId })` / equivalent check has already succeeded) —
 * this mirrors src/lib/auditLog.ts, which makes the same assumption.
 *
 * Error handling depends on whether the caller passed `db` (an active
 * transaction): if it did, a write failure is allowed to propagate so the
 * whole transaction rolls back together with the business operation it
 * describes (spec Step 10). If it didn't — the common, standalone case —
 * this is best-effort and swallows its own errors, same as logAudit: a
 * failure to record history must never break the action being recorded.
 */
export async function recordActivity(params: RecordActivityParams): Promise<void> {
  const db = params.db ?? prisma;
  const write = () =>
    db.activity.create({
      data: {
        firmId: params.firmId,
        entityType: params.entityType,
        entityId: params.entityId,
        actorType: params.actorType ?? "USER",
        actorId: params.actorId ?? undefined,
        eventType: params.eventType,
        title: params.title,
        description: params.description,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });

  if (params.db) {
    await write();
    return;
  }
  try {
    await write();
  } catch (err) {
    console.error("[activity] failed to record", params.eventType, err);
  }
}

/** Cheap existence+ownership check per entity type — no per-entity foreign key exists on Activity itself (see schema comment), so this is what makes "verify entity ownership" (spec Step 21) real rather than assumed. */
async function entityBelongsToFirm(firmId: string, entityType: ActivityEntityType, entityId: string): Promise<boolean> {
  switch (entityType) {
    case "CLIENT":
      return !!(await prisma.client.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "STAFF":
      return !!(await prisma.user.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "TASK":
      return !!(await prisma.task.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "LEAD":
      return !!(await prisma.lead.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "DOCUMENT":
      return !!(await prisma.document.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "INVOICE":
      return !!(await prisma.invoice.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "QUOTATION":
      return !!(await prisma.quotation.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "RECONCILIATION":
      return !!(await prisma.reconciliationRun.findFirst({ where: { id: entityId, firmId }, select: { id: true } }));
    case "FIRM":
      return entityId === firmId;
    default:
      return false;
  }
}

export type ActivityTimelinePage = {
  ok: true;
  activities: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    metadata: unknown;
    actorType: ActivityActorType;
    actor: { id: string; name: string } | null;
    createdAt: Date;
  }>;
  nextCursor: string | null;
};

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 50;

/**
 * Paginated read for one entity's timeline. `firmId` must come from the
 * caller's own session (never from the browser) — this both scopes the
 * query and is checked against the entity itself via entityBelongsToFirm,
 * so a request for another firm's entity returns `{ ok: false }` (map to
 * 404 in the route) rather than an empty-but-technically-reachable list.
 */
export async function getEntityActivityTimeline(params: {
  firmId: string;
  entityType: ActivityEntityType;
  entityId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ActivityTimelinePage | { ok: false }> {
  const owned = await entityBelongsToFirm(params.firmId, params.entityType, params.entityId);
  if (!owned) return { ok: false };

  const limit = Math.min(Math.max(params.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const rows = await prisma.activity.findMany({
    where: { firmId: params.firmId, entityType: params.entityType, entityId: params.entityId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    include: { actor: { select: { id: true, name: true } } },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    ok: true,
    activities: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export type ClientUnifiedActivityPage = {
  ok: true;
  activities: Array<{
    id: string;
    eventType: string;
    title: string;
    description: string | null;
    metadata: unknown;
    actorType: ActivityActorType;
    actor: { id: string; name: string } | null;
    createdAt: Date;
    // Kept on this merged result (unlike ActivityTimelinePage's narrower
    // shape) so a caller can tell which underlying entity an item came from
    // — needed once CLIENT/INVOICE/QUOTATION rows are interleaved together.
    entityType: ActivityEntityType;
    entityId: string;
  }>;
  // Client 360 Phase 1 (Unified Activity Feed) is an initial merged load
  // only — always null. Cross-entity "Load more" is an explicitly deferred
  // Phase 2 (it needs GET /api/activity itself to accept more than one
  // entityType/entityId pair, which it deliberately does not yet). Passing
  // this straight through as ActivityTimeline's initialNextCursor means its
  // existing "Load more" button simply never renders for this feed — not
  // broken, not misleading, just correctly absent until Phase 2 ships.
  nextCursor: null;
};

const CLIENT_UNIFIED_ACTIVITY_LIMIT = 30; // matches DEFAULT_PAGE_SIZE above

/**
 * Client 360 Phase 1 (Unified Activity Feed) — merges CLIENT-entity activity
 * with activity recorded against every Invoice/Quotation belonging to this
 * client, sorted together chronologically.
 *
 * Fixes a confirmed blind spot: INVOICE_PAID/QUOTATION_ACCEPTED/etc. are
 * recorded with entityType INVOICE/QUOTATION and entityId = that row's own
 * id, never the client's — so getEntityActivityTimeline's strict single
 * entityType+entityId filter never surfaces them on the client's own
 * timeline, even though InvoicesPanel/QuotationsPanel sit right next to it
 * on the same page.
 *
 * Security: invoice/quotation ids are looked up HERE, scoped to
 * {clientId, firmId} — never accepted as a parameter — so "which ids are
 * allowed to shape this query" stays inside this function's own trust
 * boundary rather than depending on every call site re-deriving it
 * correctly. The final activity query also independently filters on
 * firmId, as a second, redundant guard.
 *
 * Bounded, non-N+1: exactly 3 queries total regardless of how many
 * invoices/quotations or how much activity the client has (two id-only
 * lookups, then one merged activity query) — never one query per
 * invoice/quotation.
 */
export async function getClientUnifiedActivityTimeline(params: {
  firmId: string;
  clientId: string;
}): Promise<ClientUnifiedActivityPage> {
  const [invoices, quotations] = await Promise.all([
    prisma.invoice.findMany({ where: { clientId: params.clientId, firmId: params.firmId }, select: { id: true } }),
    prisma.quotation.findMany({ where: { clientId: params.clientId, firmId: params.firmId }, select: { id: true } }),
  ]);

  const rows = await prisma.activity.findMany({
    where: {
      firmId: params.firmId,
      OR: [
        { entityType: "CLIENT", entityId: params.clientId },
        { entityType: "INVOICE", entityId: { in: invoices.map((i) => i.id) } },
        { entityType: "QUOTATION", entityId: { in: quotations.map((q) => q.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: CLIENT_UNIFIED_ACTIVITY_LIMIT,
    include: { actor: { select: { id: true, name: true } } },
  });

  return { ok: true, activities: rows, nextCursor: null };
}
