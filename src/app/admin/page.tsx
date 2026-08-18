import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isSuperAdminEmail } from "@/lib/superAdmin";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/LogoutButton";

function daysLeft(d: Date | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

const STATUS_STYLE: Record<string, string> = {
  TRIALING: "bg-amber-50 text-amber-700",
  ACTIVE: "bg-green-50 text-green-700",
  PAST_DUE: "bg-red-50 text-red-700",
  CANCELED: "bg-slate-100 text-slate-500",
};

export default async function AdminPage() {
  const session = getSession();
  if (!session || !isSuperAdminEmail(session.email)) redirect("/dashboard");

  const firms = await prisma.firm.findMany({
    include: {
      plan: true,
      subscription: true,
      _count: { select: { users: true, clients: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalFirms = firms.length;
  const activeTrials = firms.filter((f) => f.subscription?.status === "TRIALING").length;
  const activePaid = firms.filter((f) => f.subscription?.status === "ACTIVE").length;
  const pastDue = firms.filter((f) => f.subscription?.status === "PAST_DUE").length;
  const estArr = firms
    .filter((f) => f.subscription?.status === "ACTIVE" && f.plan)
    .reduce((sum, f) => sum + (f.plan?.priceAnnualInr ?? 0), 0);

  const expiringSoon = firms.filter((f) => {
    if (f.subscription?.status !== "TRIALING") return false;
    const d = daysLeft(f.subscription.trialEndsAt);
    return d !== null && d <= 7;
  });

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="text-lg font-extrabold">
            Artha<span className="text-accent">.</span>
            <span className="text-xs font-normal text-gray-500 ml-2">Platform Admin</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{session.email}</span>
            <LogoutButton />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border border-line rounded-xl bg-white p-4">
            <div className="text-2xl font-extrabold">{totalFirms}</div>
            <div className="text-xs text-gray-500 mt-1">Total Firms</div>
          </div>
          <div className="border border-line rounded-xl bg-white p-4">
            <div className="text-2xl font-extrabold text-amber-700">{activeTrials}</div>
            <div className="text-xs text-gray-500 mt-1">On Trial</div>
          </div>
          <div className="border border-line rounded-xl bg-white p-4">
            <div className="text-2xl font-extrabold text-green-700">{activePaid}</div>
            <div className="text-xs text-gray-500 mt-1">Paid Subscriptions</div>
          </div>
          <div className="border border-line rounded-xl bg-white p-4">
            <div className="text-2xl font-extrabold text-accent">{fmtInr(estArr)}</div>
            <div className="text-xs text-gray-500 mt-1">Est. Annual Recurring Revenue</div>
          </div>
        </div>

        {pastDue > 0 && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {pastDue} firm{pastDue > 1 ? "s" : ""} {pastDue > 1 ? "are" : "is"} past due on payment.
          </div>
        )}

        {/* Trial expiry alerts */}
        {expiringSoon.length > 0 && (
          <div>
            <h2 className="text-sm font-bold mb-2">Trials Expiring Soon</h2>
            <div className="border border-amber-200 rounded-xl bg-amber-50 divide-y divide-amber-200">
              {expiringSoon.map((f) => {
                const d = daysLeft(f.subscription!.trialEndsAt);
                return (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium">{f.name}</span>
                    <span className={d !== null && d < 0 ? "text-red-700 font-semibold" : "text-amber-700 font-semibold"}>
                      {d !== null && d < 0 ? `Expired ${Math.abs(d)}d ago` : `${d}d left`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Firms table */}
        <div>
          <h2 className="text-sm font-bold mb-2">All Firms</h2>
          <div className="border border-line rounded-xl bg-white overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-paper-dim text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left font-semibold py-2.5 px-4">Firm</th>
                  <th className="text-left font-semibold py-2.5 px-4">Plan</th>
                  <th className="text-left font-semibold py-2.5 px-4">Status</th>
                  <th className="text-left font-semibold py-2.5 px-4">Trial Ends</th>
                  <th className="text-right font-semibold py-2.5 px-4">Users</th>
                  <th className="text-right font-semibold py-2.5 px-4">Clients</th>
                  <th className="text-left font-semibold py-2.5 px-4">Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => {
                  const status = f.subscription?.status ?? "—";
                  const d = daysLeft(f.subscription?.trialEndsAt ?? null);
                  return (
                    <tr key={f.id} className="border-t border-line">
                      <td className="py-2.5 px-4 font-medium">{f.name}</td>
                      <td className="py-2.5 px-4 text-gray-600">{f.plan?.name ?? "No Plan"}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-500"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">
                        {f.subscription?.status === "TRIALING" && f.subscription.trialEndsAt
                          ? `${fmtDate(f.subscription.trialEndsAt)}${d !== null ? ` (${d < 0 ? "expired" : `${d}d`})` : ""}`
                          : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right">{f._count.users}</td>
                      <td className="py-2.5 px-4 text-right">{f._count.clients}</td>
                      <td className="py-2.5 px-4 text-gray-600">{fmtDate(f.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
