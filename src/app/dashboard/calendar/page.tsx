import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CalendarGrid from "@/components/CalendarGrid";

export default async function CalendarPage() {
  const session = getSession();
  const firmId = session!.firmId;
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const [tasks, dscExpiring] = await Promise.all([
    prisma.task.findMany({
      where: { firmId, dueDate: { not: null } },
      select: { id: true, title: true, dueDate: true, status: true, client: { select: { name: true } } },
    }),
    prisma.dscRecord.findMany({
      where: { client: { firmId }, expiresAt: { lt: in60Days } },
      include: { client: { select: { name: true } } },
      orderBy: { expiresAt: "asc" },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Compliance Calendar</h1>
      <p className="text-sm text-gray-500 mb-6">All client deadlines in one place, plus upcoming DSC expiries.</p>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <CalendarGrid tasks={tasks as any} />
        </div>
        <div className="border border-line rounded-xl bg-white p-5 h-fit">
          <h3 className="font-bold text-sm mb-3">DSC Expiring (60 days)</h3>
          {dscExpiring.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing expiring soon.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dscExpiring.map((d) => {
                const daysLeft = Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000);
                return (
                  <li key={d.id} className="flex justify-between">
                    <span>{d.holderName} <span className="text-gray-400">({d.client.name})</span></span>
                    <span className={daysLeft < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                      {daysLeft < 0 ? "Expired" : `${daysLeft}d`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
