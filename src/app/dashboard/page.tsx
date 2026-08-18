import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStaffLoadForFirm } from "@/lib/recurringTasks";
import { listPendingAgentActions } from "@/lib/agentActions";
import { taskHref } from "@/lib/taskBoard";
import { getCreateMenuItems } from "@/lib/homeCreateMenu";
import HomeCreateMenu from "@/components/HomeCreateMenu";

// H1 Home Experience — visual-parity pass against an approved reference
// screenshot (see the scope confirmation this batch started with). Layout:
// Header -> Pulse (5 KPI cards) -> [Attention | Operational Pulse] ->
// [Compliance + Quick Actions | Recent Activity] -> Go to. Still one Server
// Component, matching Reports/Staff's single-file convention; HomeCreateMenu
// stays the only "use client" piece. Sidebar, top bar (notifications, user
// menu) are explicitly out of scope this pass — those live in
// SidebarNav.tsx/DashboardLayout.tsx, not here, and were confirmed untouched.
const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000; // matches /dashboard/staff's own "due soon" window
const DSC_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // matches this page's pre-existing DSC window (unchanged)
const HEAVY_LOAD_THRESHOLD = 10; // matches loadTag's existing "Heavy" cutoff — reused, not a new number

function greetingFor(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function actorLabel(actorType: string, actorName: string | null | undefined): string {
  if (actorType === "SYSTEM") return "System";
  if (actorType === "AI") return "AI";
  return actorName ?? "Unknown";
}

// New this pass, for visual parity with the reference (relative time was
// deliberately avoided before — no such utility existed anywhere in the app;
// flagged explicitly in the implementation report as a new, first-of-its-kind
// convention, not silently added). Falls back to an absolute date past a
// week so it never reads "47 days ago".
function formatRelative(d: Date, now: Date): string {
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)));
}

// entityId on a RECONCILIATION activity is the ReconciliationRun id (see
// recordActivity calls in the reconciliation-runs route) — every other
// entity type either has a real detail page or, honestly, doesn't (LEAD,
// DOCUMENT, STAFF have no per-record page anywhere in this app today), in
// which case this points at the module's list rather than a fabricated URL.
function activityHref(entityType: string, entityId: string): string {
  switch (entityType) {
    case "CLIENT": return `/dashboard/clients/${entityId}`;
    case "TASK": return taskHref(entityId);
    case "INVOICE": return `/dashboard/invoices/${entityId}`;
    case "QUOTATION": return `/dashboard/quotations/${entityId}`;
    case "RECONCILIATION": return `/dashboard/reconciliation/runs/${entityId}`;
    case "STAFF": return "/dashboard/staff";
    case "LEAD": return "/dashboard/leads";
    case "DOCUMENT": return "/dashboard/documents";
    case "FIRM": return "/dashboard/settings";
    default: return "/dashboard";
  }
}

function loadTag(open: number): { label: string; pill: string; bar: string } {
  if (open > HEAVY_LOAD_THRESHOLD) return { label: "Heavy", pill: "bg-red-50 text-red-700", bar: "bg-red-600" };
  if (open > 5) return { label: "Moderate", pill: "bg-amber-50 text-amber-700", bar: "bg-amber-500" };
  return { label: "Light", pill: "bg-green-50 text-green-700", bar: "bg-green-600" };
}

function initialsOf(name: string): string {
  return (name || "—").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "—";
}

const rowClass =
  "flex items-center gap-3 px-4 py-3 hover:bg-paper-dim focus-visible:bg-paper-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent transition-colors group";

function SeverityBadge({ level }: { level: "High" | "Medium" }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${level === "High" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
      {level}
    </span>
  );
}

// Small inline stroke icons — matches the outline style already used
// elsewhere in this app (e.g. the marketing page's trust/credibility icons)
// rather than pulling in a new icon library/dependency.
const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, width: 16, height: 16 };
const Icon = {
  Warning: () => <svg {...ICON_PROPS}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  Clock: () => <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  Scale: () => <svg {...ICON_PROPS}><path d="M12 3v18M7 8l-4 8a4 4 0 0 0 8 0l-4-8Zm10 0-4 8a4 4 0 0 0 8 0l-4-8ZM5 8h4M15 8h4" /></svg>,
  Doc: () => <svg {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" /></svg>,
  TrendUp: () => <svg {...ICON_PROPS}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  Shield: () => <svg {...ICON_PROPS}><path d="M12 2 3 6v6c0 5 3.8 8.7 9 10 5.2-1.3 9-5 9-10V6l-9-4z" /></svg>,
  Users: () => <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Refresh: () => <svg {...ICON_PROPS} width="12" height="12"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>,
};

function KpiIconCircle({ tone, children }: { tone: "red" | "blue" | "green" | "amber"; children: React.ReactNode }) {
  const cls = { red: "bg-red-50 text-red-600", blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600" }[tone];
  return <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cls}`}>{children}</span>;
}

export default async function DashboardOverview() {
  const session = getSession();
  const firmId = session!.firmId;
  const userId = session!.userId;
  const isStaff = session!.role === "STAFF";
  const canAddStaff = session!.role === "PARTNER"; // matches the real POST /api/staff gate exactly, not "not STAFF"
  const canCreateFinancial = !isStaff; // matches POST /api/invoices and /api/quotations, both reject STAFF only

  const now = new Date();
  const dueSoonEnd = new Date(now.getTime() + DUE_SOON_MS);
  const dscEnd = new Date(now.getTime() + DSC_WINDOW_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mine = isStaff ? { assigneeId: userId } : {};

  const [
    me,
    overdueTasks, overdueCount, dueSoonCount, overdueClientRows,
    exceptionCount, exceptionClientRows,
    failedRuns,
    agentActions,
    outstandingAgg, revenueAgg,
    dscUpcoming,
    staffLoad,
    recentActivity,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.task.findMany({
      where: { firmId, status: { not: "DONE" }, dueDate: { lt: now }, ...mine },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { client: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true } } },
    }),
    prisma.task.count({ where: { firmId, status: { not: "DONE" }, dueDate: { lt: now }, ...mine } }),
    prisma.task.count({ where: { firmId, status: { not: "DONE" }, dueDate: { gte: now, lte: dueSoonEnd }, ...mine } }),
    prisma.task.findMany({
      where: { firmId, status: { not: "DONE" }, dueDate: { lt: now }, clientId: { not: null }, ...mine },
      distinct: ["clientId"],
      select: { clientId: true },
    }),
    prisma.reconciliationMatch.count({ where: { status: "EXCEPTION", reconciliationRun: { firmId } } }),
    prisma.reconciliationRun.findMany({
      where: { firmId, matches: { some: { status: "EXCEPTION" } } },
      distinct: ["clientId"],
      select: { clientId: true },
    }),
    // New this pass (confirmed scope: "Add failed-run detection") — read-only,
    // no schema/write change. Oldest-first so the Attention row can show
    // "oldest N days" the same way the overdue-tasks row already does.
    prisma.reconciliationRun.findMany({
      where: { firmId, status: "FAILED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, clientId: true },
    }),
    listPendingAgentActions(firmId),
    isStaff ? Promise.resolve(null) : prisma.invoice.aggregate({ where: { firmId, status: { in: ["SENT", "OVERDUE"] } }, _sum: { total: true }, _count: true }),
    isStaff ? Promise.resolve(null) : prisma.invoice.aggregate({ where: { firmId, status: "PAID", paidAt: { gte: monthStart } }, _sum: { total: true } }),
    prisma.dscRecord.findMany({
      where: { client: { firmId }, expiresAt: { lt: dscEnd } },
      orderBy: { expiresAt: "asc" },
      take: 5,
      select: { id: true, holderName: true, expiresAt: true, client: { select: { id: true, name: true } } },
    }),
    isStaff ? Promise.resolve([]) : getStaffLoadForFirm(firmId),
    prisma.activity.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, entityType: true, entityId: true, title: true, actorType: true, actor: { select: { name: true } }, createdAt: true },
    }),
  ]);

  // Team load needs staff names + a per-person overdue count — a second
  // query phase, same two-phase shape /dashboard/staff itself already uses.
  // Kept as the FULL list (not sliced) so the Attention row's "N overloaded"
  // count is accurate even if the firm has more than 5 heavy staff; only the
  // panel's own display is capped, below.
  let teamLoadAll: { userId: string; name: string; open: number; overdue: number }[] = [];
  if (!isStaff && staffLoad.length > 0) {
    const staffIds = staffLoad.map((s) => s.userId);
    const [users, staffOpenTasks] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }),
      prisma.task.findMany({ where: { firmId, assigneeId: { in: staffIds }, status: { not: "DONE" }, dueDate: { lt: now } }, select: { assigneeId: true } }),
    ]);
    teamLoadAll = staffLoad
      .map((s) => ({
        userId: s.userId,
        name: users.find((u) => u.id === s.userId)?.name ?? "—",
        open: s.load,
        overdue: staffOpenTasks.filter((t) => t.assigneeId === s.userId).length,
      }))
      .sort((a, b) => b.open - a.open);
  }
  const overloadedCount = teamLoadAll.filter((r) => r.open > HEAVY_LOAD_THRESHOLD).length;
  const teamLoadRows = teamLoadAll.slice(0, 5); // compact display cap — the Attention count above isn't affected by this

  const distinctOverdueClients = new Set(overdueClientRows.map((t) => t.clientId)).size;
  const distinctExceptionClients = new Set(exceptionClientRows.map((r) => r.clientId)).size;
  const oldestOverdueDays = overdueTasks[0]?.dueDate ? daysBetween(overdueTasks[0].dueDate, now) : 0;
  const distinctFailedClients = new Set(failedRuns.map((r) => r.clientId)).size;
  const oldestFailedDays = failedRuns[0] ? daysBetween(failedRuns[0].createdAt, now) : 0;

  const hasAttention =
    failedRuns.length > 0 || overdueCount > 0 || exceptionCount > 0 || agentActions.length > 0 || dscUpcoming.length > 0 || overloadedCount > 0;
  const kpiCols = isStaff ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";
  const createMenuItems = getCreateMenuItems(canCreateFinancial, canAddStaff);

  return (
    <div>
      {/* A. HEADER */}
      <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-[26px] font-medium tracking-tight text-ink">
            {greetingFor(now)}, {(me?.name ?? session!.email.split("@")[0]).split(" ")[0]}
            <span className="text-accent">.</span>
          </h1>
          <p className="text-[13px] text-gray-500 mt-1">
            <span className="text-gray-400 font-semibold">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </span>{" "}
            — here&apos;s what needs you today.
          </p>
        </div>
        <HomeCreateMenu canCreateFinancial={canCreateFinancial} canAddStaff={canAddStaff} />
      </div>

      {/* B. KPI PULSE — 5 bordered icon cards (this pass's confirmed direction, superseding the earlier compact-strip rule) */}
      <div className={`grid ${kpiCols} gap-4 mb-8`}>
        <Link href={`/dashboard/tasks?view=${isStaff ? "mine" : "all"}&overdue=true`} className="border border-line rounded-xl bg-white p-4 flex items-start gap-3 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-shadow">
          <KpiIconCircle tone="red"><Icon.Warning /></KpiIconCircle>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Overdue Work</div>
            <div className="font-serif text-2xl font-semibold tabular-nums text-ink">{overdueCount}</div>
            <div className="text-[11px] text-red-600 font-semibold">{overdueCount === 1 ? "Task overdue" : "Tasks overdue"}</div>
          </div>
        </Link>
        <Link href={`/dashboard/tasks?view=${isStaff ? "mine" : "all"}`} className="border border-line rounded-xl bg-white p-4 flex items-start gap-3 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-shadow">
          <KpiIconCircle tone="blue"><Icon.Clock /></KpiIconCircle>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Due Soon</div>
            <div className="font-serif text-2xl font-semibold tabular-nums text-ink">{dueSoonCount}</div>
            <div className="text-[11px] text-gray-400">Next 3 days</div>
          </div>
        </Link>
        <Link href="/dashboard/reconciliation" className="border border-line rounded-xl bg-white p-4 flex items-start gap-3 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-shadow">
          <KpiIconCircle tone={exceptionCount > 0 ? "amber" : "green"}><Icon.Scale /></KpiIconCircle>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Reconciliation</div>
            <div className="font-serif text-2xl font-semibold tabular-nums text-ink">{exceptionCount}</div>
            <div className={`text-[11px] font-semibold ${exceptionCount > 0 ? "text-amber-600" : "text-green-600"}`}>
              {exceptionCount > 0 ? "Exceptions found" : "All clear"}
            </div>
          </div>
        </Link>
        {!isStaff && (
          <Link href="/dashboard/invoices" className="border border-line rounded-xl bg-white p-4 flex items-start gap-3 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-shadow">
            <KpiIconCircle tone="blue"><Icon.Doc /></KpiIconCircle>
            <div className="min-w-0">
              <div className="text-xs text-gray-500">Outstanding</div>
              <div className="font-serif text-2xl font-semibold tabular-nums text-ink">₹{(outstandingAgg?._sum.total ?? 0).toLocaleString("en-IN")}</div>
              <div className="text-[11px] text-gray-400">{outstandingAgg?._count ?? 0} invoices</div>
            </div>
          </Link>
        )}
        {!isStaff && (
          <Link href="/dashboard/reports" className="border border-line rounded-xl bg-white p-4 flex items-start gap-3 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-shadow">
            <KpiIconCircle tone="green"><Icon.TrendUp /></KpiIconCircle>
            <div className="min-w-0">
              <div className="text-xs text-gray-500">Revenue (MTD)</div>
              <div className="font-serif text-2xl font-semibold tabular-nums text-ink">₹{(revenueAgg?._sum.total ?? 0).toLocaleString("en-IN")}</div>
              <div className="text-[11px] text-gray-400">This month</div>
            </div>
          </Link>
        )}
      </div>

      {/* C. [ATTENTION | OPERATIONAL PULSE] */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">
            {isStaff ? "Needs your attention" : "Needs your attention — firm-wide"}
          </div>
          {!hasAttention ? (
            <div className="border border-line rounded-xl bg-white flex items-center gap-3.5 px-5 py-5">
              <span className="text-green-600 text-xl" aria-hidden="true">✓</span>
              <div>
                <div className="text-sm font-bold text-green-700">You&apos;re all caught up.</div>
                <div className="text-xs text-gray-500 mt-0.5">Nothing overdue, review queue clear, no DSCs expiring soon.</div>
              </div>
            </div>
          ) : (
            <div className="border border-line rounded-xl bg-white overflow-hidden divide-y divide-line">
              {failedRuns.length > 0 && (
                <Link href="/dashboard/reconciliation/runs" className={rowClass}>
                  <KpiIconCircle tone="red"><Icon.Warning /></KpiIconCircle>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">GST reconciliation failed</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {distinctFailedClients} client{distinctFailedClients === 1 ? "" : "s"} affected · oldest {oldestFailedDays}d
                    </div>
                  </div>
                  <SeverityBadge level="High" />
                  <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
                </Link>
              )}
              {overdueCount > 0 && (
                <Link href={`/dashboard/tasks?view=${isStaff ? "mine" : "all"}&overdue=true`} className={rowClass}>
                  <KpiIconCircle tone="red"><Icon.Clock /></KpiIconCircle>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">{overdueCount} task{overdueCount === 1 ? "" : "s"} {overdueCount === 1 ? "is" : "are"} overdue</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Oldest {oldestOverdueDays}d · Across {distinctOverdueClients} client{distinctOverdueClients === 1 ? "" : "s"}
                    </div>
                  </div>
                  <SeverityBadge level={oldestOverdueDays > 5 || overdueCount > 10 ? "High" : "Medium"} />
                  <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
                </Link>
              )}
              {exceptionCount > 0 && (
                <Link href="/dashboard/reconciliation" className={rowClass}>
                  <KpiIconCircle tone="amber"><Icon.Scale /></KpiIconCircle>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">Reconciliation exceptions unresolved</div>
                    <div className="text-xs text-gray-500 mt-0.5">Ranked by risk · {distinctExceptionClients} client{distinctExceptionClients === 1 ? "" : "s"}</div>
                  </div>
                  <SeverityBadge level="Medium" />
                  <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
                </Link>
              )}
              {agentActions.length > 0 && (
                <Link href="/dashboard/agent-review" className={rowClass}>
                  <KpiIconCircle tone="amber"><Icon.Warning /></KpiIconCircle>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">Agent proposals awaiting review</div>
                    <div className="text-xs text-gray-500 mt-0.5">Tier 2/3 — needs a human decision</div>
                  </div>
                  <SeverityBadge level="Medium" />
                  <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
                </Link>
              )}
              {dscUpcoming.length > 0 && (
                <Link href="/dashboard/calendar" className={rowClass}>
                  <KpiIconCircle tone="blue"><Icon.Shield /></KpiIconCircle>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">
                      DSC expiring in {Math.max(0, Math.ceil((dscUpcoming[0].expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))} days
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{dscUpcoming.length} DSC certificate{dscUpcoming.length === 1 ? "" : "s"}</div>
                  </div>
                  <SeverityBadge level={Math.ceil((dscUpcoming[0].expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) <= 7 ? "High" : "Medium"} />
                  <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
                </Link>
              )}
              {overloadedCount > 0 && (
                <Link href="/dashboard/staff" className={rowClass}>
                  <KpiIconCircle tone="amber"><Icon.Users /></KpiIconCircle>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink">{overloadedCount} team member{overloadedCount === 1 ? "" : "s"} overloaded</div>
                    <div className="text-xs text-gray-500 mt-0.5">Review workload</div>
                  </div>
                  <SeverityBadge level="Medium" />
                  <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Operational Pulse</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500">{isStaff ? "Your overdue work" : "Overdue work"}</div>
                <Link href={`/dashboard/tasks?view=${isStaff ? "mine" : "all"}&overdue=true`} className="text-[11px] font-semibold text-accent">All →</Link>
              </div>
              {overdueTasks.length === 0 ? (
                <div className="border border-line rounded-xl bg-white px-4 py-5 text-center">
                  <div className="text-xs font-semibold text-ink">Nothing overdue.</div>
                </div>
              ) : (
                <div className="border border-line rounded-xl bg-white overflow-hidden divide-y divide-line">
                  {overdueTasks.slice(0, 4).map((t) => {
                    const days = t.dueDate ? daysBetween(t.dueDate, now) : 0;
                    return (
                      <Link key={t.id} href={taskHref(t.id)} className={`${rowClass} gap-2 px-3 py-2.5`}>
                        <span className="text-gray-400 shrink-0"><Icon.Doc /></span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-semibold text-ink truncate" title={t.client ? `${t.title} — ${t.client.name}` : t.title}>
                            {t.title}{t.client && <span className="text-gray-400 font-normal"> — {t.client.name}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-red-600 shrink-0">{days}d</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {!isStaff && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-500">Team load</div>
                  <Link href="/dashboard/staff" className="text-[11px] font-semibold text-accent">All →</Link>
                </div>
                {teamLoadRows.length === 0 ? (
                  <div className="border border-line rounded-xl bg-white px-4 py-5 text-center">
                    <div className="text-xs font-semibold text-ink">No workload concerns.</div>
                  </div>
                ) : (
                  <div className="border border-line rounded-xl bg-white overflow-hidden divide-y divide-line">
                    {teamLoadRows.map((r) => {
                      const tag = loadTag(r.open);
                      const maxOpen = Math.max(1, ...teamLoadRows.map((x) => x.open));
                      return (
                        <Link key={r.userId} href="/dashboard/staff" className={`${rowClass} gap-2 px-3 py-2.5`}>
                          <span className="w-5 h-5 rounded-full bg-accent-light text-accent text-[9px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                            {initialsOf(r.name)}
                          </span>
                          <span className="text-[12.5px] font-semibold text-ink truncate w-16 shrink-0" title={r.name}>{r.name}</span>
                          <div className="flex-1 bg-paper-dim rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${tag.bar}`} style={{ width: `${(r.open / maxOpen) * 100}%` }} />
                          </div>
                          <span className={`text-[10.5px] shrink-0 ${r.overdue > 0 ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                            {r.overdue > 0 ? `${r.overdue} overdue` : "On track"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* D. [COMPLIANCE + QUICK ACTIONS | RECENT ACTIVITY] */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-6">
          <div>
            <div className="flex items-baseline justify-between mb-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Compliance</div>
              <Link href="/dashboard/calendar" className="text-xs font-semibold text-accent">View all →</Link>
            </div>
            {dscUpcoming.length === 0 ? (
              <div className="border border-line rounded-xl bg-white px-5 py-6 text-center">
                <div className="text-sm font-semibold text-ink">You&apos;re covered.</div>
                <div className="text-xs text-gray-500 mt-1">No DSC expiries require attention soon.</div>
              </div>
            ) : (
              <Link href="/dashboard/calendar" className={`border border-line rounded-xl bg-white ${rowClass}`}>
                <KpiIconCircle tone="blue"><Icon.Shield /></KpiIconCircle>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink">DSC certificates</div>
                  <div className="text-xs text-gray-500 mt-0.5">{dscUpcoming.length} expiring in next 30 days</div>
                </div>
                <span className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Quick Actions</div>
            <div className="border border-line rounded-xl bg-white p-4 grid grid-cols-3 sm:grid-cols-5 gap-3">
              {createMenuItems.map((item) => (
                <Link
                  key={item.href + item.title}
                  href={item.href}
                  className="flex flex-col items-center gap-1.5 text-center rounded-lg p-2 hover:bg-paper-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors"
                >
                  <span className="w-9 h-9 rounded-full bg-accent-light text-accent flex items-center justify-center text-sm font-bold" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-semibold text-charcoal leading-tight">{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Recent Activity</div>
          {recentActivity.length === 0 ? (
            <div className="border border-line rounded-xl bg-white px-5 py-6 text-center">
              <div className="text-sm font-semibold text-ink">No activity yet.</div>
              <div className="text-xs text-gray-500 mt-1">Firm activity will appear here as it happens.</div>
            </div>
          ) : (
            <div className="border border-line rounded-xl bg-white overflow-hidden divide-y divide-line">
              {recentActivity.map((a) => (
                <Link key={a.id} href={activityHref(a.entityType, a.entityId)} className={`${rowClass} items-start`}>
                  <span className="w-6 h-6 rounded-full bg-accent-light text-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                    {initialsOf(actorLabel(a.actorType, a.actor?.name))}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12px] text-charcoal leading-snug">
                      <span className="font-semibold text-ink">{actorLabel(a.actorType, a.actor?.name)}</span> {a.title}
                    </div>
                    <div className="text-[10.5px] text-gray-400 mt-0.5">{formatRelative(a.createdAt, now)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* E. GO TO */}
      <div className="mb-6">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Go to</div>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/dashboard/clients", label: "Clients" },
            { href: "/dashboard/documents", label: "Documents" },
            { href: "/dashboard/reconciliation/runs", label: "Reconciliation Runs" },
            { href: "/dashboard/reports", label: "Reports" },
            { href: "/dashboard/tasks/templates", label: "Task Templates" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="border border-line bg-white rounded-full px-3.5 py-1.5 text-xs font-semibold text-charcoal hover:border-accent hover:text-accent hover:bg-accent-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {/* F. FOOTER TIMESTAMP — honest: this is the moment the server rendered
          the page, not a live/polling indicator (none exists). */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
        <Icon.Refresh />
        Last updated {now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
      </div>
    </div>
  );
}
