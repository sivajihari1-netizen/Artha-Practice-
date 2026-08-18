"use client";

import { useEffect, useState } from "react";

export type ActivityEntry = {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  actorType: "USER" | "SYSTEM" | "AI";
  actor: { id: string; name: string } | null;
  createdAt: string; // ISO
};

const EVENT_ICON: Record<string, string> = {
  CLIENT_CREATED: "🆕", CLIENT_UPDATED: "✏️",
  TASK_CREATED: "🆕", TASK_UPDATED: "✏️", TASK_ASSIGNED: "👤", TASK_STATUS_CHANGED: "🔁", TASK_COMPLETED: "✅",
  LEAD_CREATED: "🆕", LEAD_UPDATED: "✏️", LEAD_STAGE_CHANGED: "🔁", LEAD_CONVERTED: "🎉",
  DOCUMENT_UPLOADED: "📄", DOCUMENT_REPLACED: "📄", DOCUMENT_DELETED: "🗑️",
  INVOICE_CREATED: "🆕", INVOICE_SENT: "📤", INVOICE_PAID: "💰", INVOICE_CANCELLED: "🚫",
  QUOTATION_CREATED: "🆕", QUOTATION_SENT: "📤", QUOTATION_ACCEPTED: "✅", QUOTATION_DECLINED: "🚫",
  RECONCILIATION_CREATED: "🆕", RECONCILIATION_EXCEPTION: "⚠️", RECONCILIATION_RESOLVED: "✅", RECONCILIATION_IGNORED: "🙈",
  STAFF_CREATED: "🆕", STAFF_UPDATED: "✏️", FIRM_UPDATED: "✏️",
};

function actorLabel(entry: ActivityEntry): string {
  if (entry.actorType === "AI") return "AI";
  if (entry.actorType === "SYSTEM") return "System";
  return entry.actor?.name ?? "Unknown";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Business-context timeline for one entity — reads from GET /api/activity,
 * which itself reads via src/lib/activity.ts's getEntityActivityTimeline().
 * `compact` caps the list to one page with no "Load more" (used on the
 * Leads Kanban card, where there isn't room for a full paginated list) —
 * the full, paginated form is used on the Client detail page.
 *
 * `lazy` fetches on mount instead of trusting `initialActivities` — for a
 * card inside a list of many (e.g. every Lead on the board), eagerly
 * server-fetching each one's timeline just to render a collapsed card would
 * be an N+1 query for history nobody may ever open; the Leads board only
 * mounts this (with `lazy`) once a card's History section is expanded.
 */
export default function ActivityTimeline({
  entityType,
  entityId,
  initialActivities,
  initialNextCursor,
  compact = false,
  lazy = false,
}: {
  entityType: string;
  entityId: string;
  initialActivities: ActivityEntry[];
  initialNextCursor: string | null;
  compact?: boolean;
  lazy?: boolean;
}) {
  const [activities, setActivities] = useState(initialActivities);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(lazy);
  const [error, setError] = useState<string | null>(null);

  async function fetchPage(afterCursor?: string) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ entityType, entityId, ...(afterCursor ? { cursor: afterCursor } : {}) });
    const res = await fetch(`/api/activity?${params.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setError("Couldn't load activity.");
      return;
    }
    const data = await res.json();
    setActivities((prev) => (afterCursor ? [...prev, ...data.activities] : data.activities));
    setCursor(data.nextCursor);
  }

  useEffect(() => {
    if (lazy) fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lazy, entityType, entityId]);

  if (loading && activities.length === 0) {
    return <p className="text-xs text-gray-400">Loading…</p>;
  }
  if (activities.length === 0) {
    return <p className="text-xs text-gray-400">No activity recorded yet.</p>;
  }

  return (
    <div>
      <ul className="space-y-3">
        {activities.map((entry) => (
          <li key={entry.id} className="flex gap-2 text-sm">
            <span className="shrink-0" aria-hidden="true">{EVENT_ICON[entry.eventType] ?? "•"}</span>
            <div className="min-w-0">
              <div className="font-medium">{entry.title}</div>
              {entry.description && <div className="text-xs text-gray-500">{entry.description}</div>}
              <div className="text-xs text-gray-400">
                {actorLabel(entry)} · {formatTimestamp(entry.createdAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!compact && cursor && (
        <button onClick={() => fetchPage(cursor)} disabled={loading} className="mt-3 text-xs font-semibold text-accent disabled:opacity-60">
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
