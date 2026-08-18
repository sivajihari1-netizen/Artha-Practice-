import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTaskCategoryLabel } from "@/lib/taskWorkflow";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line rounded-xl p-5 bg-white">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default async function ReportsPage() {
  const session = getSession();
  const firmId = session!.firmId;
  const userId = session!.userId;
  // Decision 4 (IA restructure): STAFF gets read-only Insights scoped to their
  // OWN task-completion metrics — never firm-wide revenue or other staff's
  // workload. Enforced here as a query-level filter (different `where`
  // clauses, and the revenue aggregates aren't fetched at all for STAFF),
  // not a post-fetch UI hide, since this is the same data a future
  // /api/reports endpoint would need to guard identically.
  const isStaff = session!.role === "STAFF";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    revenueThisMonthAgg,
    outstandingAgg,
    tasksCompletedThisMonth,
    overdueByAssignee,
    completedByReturnType,
    topClients,
  ] = await Promise.all([
    isStaff
      ? Promise.resolve(null)
      : prisma.invoice.aggregate({
          where: { firmId, status: "PAID", paidAt: { gte: monthStart } },
          _sum: { total: true },
        }),
    isStaff
      ? Promise.resolve(null)
      : prisma.invoice.aggregate({
          where: { firmId, status: { in: ["SENT", "OVERDUE"] } },
          _sum: { total: true },
          _count: true,
        }),
    prisma.task.count({
      where: { firmId, status: "DONE", updatedAt: { gte: monthStart }, ...(isStaff ? { assigneeId: userId } : {}) },
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: { firmId, status: { not: "DONE" }, dueDate: { lt: now }, ...(isStaff ? { assigneeId: userId } : {}) },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["returnType"],
      where: { firmId, status: "DONE", updatedAt: { gte: monthStart }, ...(isStaff ? { assigneeId: userId } : {}) },
      _count: true,
    }),
    isStaff
      ? Promise.resolve([])
      : prisma.client.findMany({
          where: { firmId, active: true },
          select: { id: true, name: true, _count: { select: { tasks: true } } },
          orderBy: { tasks: { _count: "desc" } },
          take: 8,
        }),
  ]);

  const assigneeIds = overdueByAssignee.map((r) => r.assigneeId).filter((id): id is string => !!id);
  const assignees = assigneeIds.length
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const assigneeName = (id: string | null) => (id ? assignees.find((a) => a.id === id)?.name ?? "Unknown" : "Unassigned");

  const revenueThisMonth = revenueThisMonthAgg?._sum.total ?? 0;
  const outstandingTotal = outstandingAgg?._sum.total ?? 0;
  const maxClientTasks = Math.max(1, ...topClients.map((c) => c._count.tasks));

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isStaff ? "A snapshot of your own task workload." : "A snapshot of revenue, workload and where things stand."}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {!isStaff && (
          <>
            <StatCard label="Revenue This Month" value={`₹${revenueThisMonth.toLocaleString("en-IN")}`} />
            <StatCard label="Outstanding Invoices" value={`₹${outstandingTotal.toLocaleString("en-IN")} (${outstandingAgg?._count ?? 0})`} />
          </>
        )}
        <StatCard label={isStaff ? "Your Tasks Completed This Month" : "Tasks Completed This Month"} value={tasksCompletedThisMonth} />
        <StatCard label={isStaff ? "Your Overdue Tasks" : "Overdue Tasks"} value={overdueByAssignee.reduce((sum, r) => sum + r._count, 0)} />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-8">
        {!isStaff && (
          <div className="border border-line rounded-xl bg-white p-5">
            <h3 className="font-bold text-sm mb-3">Overdue Tasks by Staff</h3>
            {overdueByAssignee.length === 0 ? (
              <p className="text-xs text-gray-400">Nothing overdue — good shape.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overdueByAssignee
                  .sort((a, b) => b._count - a._count)
                  .map((r) => (
                    <li key={r.assigneeId ?? "unassigned"} className="flex justify-between">
                      <span>{assigneeName(r.assigneeId)}</span>
                      <span className="text-red-600 font-semibold">{r._count}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div className="border border-line rounded-xl bg-white p-5">
          <h3 className="font-bold text-sm mb-3">{isStaff ? "Your Completions This Month, by Return Type" : "Completed This Month, by Return Type"}</h3>
          {completedByReturnType.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing completed yet this month.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {completedByReturnType
                .sort((a, b) => b._count - a._count)
                .map((r) => (
                  <li key={r.returnType} className="flex justify-between">
                    <span>{getTaskCategoryLabel(r.returnType, [])}</span>
                    <span className="font-semibold">{r._count}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {!isStaff && (
        <div className="border border-line rounded-xl bg-white p-5">
          <h3 className="font-bold text-sm mb-3">Most Active Clients (by total tasks)</h3>
          {topClients.length === 0 ? (
            <p className="text-xs text-gray-400">No clients yet.</p>
          ) : (
            <ul className="space-y-2">
              {topClients.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate">{c.name}</span>
                  <div className="flex-1 bg-paper-dim rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full" style={{ width: `${(c._count.tasks / maxClientTasks) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-6 text-right">{c._count.tasks}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
