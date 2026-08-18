import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddStaffForm from "@/components/AddStaffForm";
import AttendanceWidget from "@/components/AttendanceWidget";
import LeavePanel from "@/components/LeavePanel";
import StaffWorkloadPanel from "@/components/StaffWorkloadPanel";
import StaffRoleStatusControls from "@/components/StaffRoleStatusControls";
import { getStaffLoadForFirm } from "@/lib/recurringTasks";

const DUE_SOON_MS = 3 * 24 * 60 * 60 * 1000; // 3 days — same "coming up soon" window used elsewhere in the dashboard

export default async function StaffPage() {
  const session = getSession();
  const firmId = session!.firmId;
  const canSeeWorkload = session!.role !== "STAFF";
  // Role change / deactivate is Partner-only on the backend (PATCH /api/staff/[id]) —
  // the control only renders for a Partner viewer, and never for a Partner's
  // own row (no self-demote/self-lockout footgun; the backend itself doesn't
  // prevent this, so this is a UI-only safety choice, not a new authorization rule).
  const canManageStaff = session!.role === "PARTNER";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [staff, myOpenLog, leaveRequests, workload] = await Promise.all([
    prisma.user.findMany({
      where: { firmId },
      select: { id: true, name: true, email: true, role: true, active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.attendanceLog.findFirst({
      where: { userId: session!.userId, checkIn: { gte: startOfToday }, checkOut: null },
    }),
    prisma.leaveRequest.findMany({
      where: session!.role === "STAFF" ? { userId: session!.userId } : { user: { firmId } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Reuses the exact same query the recurring-task load balancer already
    // runs (getStaffLoadForFirm, untouched) for the "open tasks" figure —
    // only Partner/Manager can see this, matching the app's existing pattern
    // for sensitive/oversight panels (CredentialsPanel, LeavePanel approval).
    canSeeWorkload ? getStaffLoadForFirm(firmId) : Promise.resolve([]),
  ]);

  let workloadRows: { userId: string; name: string; open: number; overdue: number; dueSoon: number }[] = [];
  if (canSeeWorkload && workload.length > 0) {
    const staffIds = workload.map((w) => w.userId);
    const [users, openTasks] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }),
      prisma.task.findMany({
        where: { firmId, assigneeId: { in: staffIds }, status: { not: "DONE" } },
        select: { assigneeId: true, dueDate: true },
      }),
    ]);
    const now = Date.now();
    workloadRows = workload.map((w) => {
      const mine = openTasks.filter((t) => t.assigneeId === w.userId);
      return {
        userId: w.userId,
        name: users.find((u) => u.id === w.userId)?.name ?? "—",
        open: w.load,
        overdue: mine.filter((t) => t.dueDate && t.dueDate.getTime() < now).length,
        dueSoon: mine.filter((t) => t.dueDate && t.dueDate.getTime() >= now && t.dueDate.getTime() <= now + DUE_SOON_MS).length,
      };
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Staff</h1>
          <p className="text-sm text-gray-500">{staff.length} team member{staff.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-3">
          <AttendanceWidget checkedIn={!!myOpenLog} />
          {session!.role === "PARTNER" && <AddStaffForm />}
        </div>
      </div>

      {canSeeWorkload && <StaffWorkloadPanel rows={workloadRows} />}

      <div className="border border-line rounded-xl bg-white overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const isSelf = s.id === session!.userId;
              return (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {isSelf && <span className="text-gray-400 font-normal"> (you)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  {canManageStaff && !isSelf ? (
                    <td className="px-4 py-3" colSpan={2}>
                      <StaffRoleStatusControls staffId={s.id} role={s.role} active={s.active} />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-500">{s.role}</td>
                      <td className="px-4 py-3 text-gray-500">{s.active ? "Active" : "Disabled"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LeavePanel requests={leaveRequests as any} canApprove={session!.role !== "STAFF"} />
    </div>
  );
}
