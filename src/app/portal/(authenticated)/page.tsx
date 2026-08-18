import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActivePortalClient } from "@/lib/clientPortalAccess";
import { getTaskCategoryLabel, getTaskStatusLabel } from "@/lib/taskWorkflow";

const STATUS_STYLE: Record<string, string> = {
  TODO: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  REVIEW: "bg-amber-50 text-amber-600",
  DONE: "bg-accent-light text-accent",
};

export default async function PortalStatusPage() {
  const client = await getActivePortalClient();
  if (!client) redirect("/portal/login");

  const tasks = await prisma.task.findMany({
    where: { clientId: client.id },
    include: {
      statusOption: { select: { id: true, name: true, systemKey: true, color: true } },
      categoryOption: { select: { id: true, name: true, systemKey: true, color: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  });

  const pending = tasks.filter((t) => t.status !== "DONE");
  const completed = tasks.filter((t) => t.status === "DONE").slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Compliance Status</h1>
      <p className="text-sm text-gray-500 mb-6">Current status of filings and work being handled for {client.name}.</p>

      <div className="border border-line rounded-xl bg-white overflow-hidden mb-8">
        <div className="px-4 py-3 border-b border-line font-bold text-sm">Upcoming &amp; In Progress</div>
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3 text-gray-500">{getTaskCategoryLabel(t.returnType, t.categoryOption ? [t.categoryOption] : [])}</td>
                <td className="px-4 py-3 text-gray-500">{t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[t.status]}`}>{getTaskStatusLabel(t.status, t.statusOption ? [t.statusOption] : [])}</span>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nothing pending right now.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-line font-bold text-sm">Recently Completed</div>
        <table className="w-full text-sm">
          <tbody>
            {completed.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3 text-gray-500">{getTaskCategoryLabel(t.returnType, t.categoryOption ? [t.categoryOption] : [])}</td>
                <td className="px-4 py-3 text-gray-500 text-right">{new Date(t.updatedAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
            {completed.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No completed items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
