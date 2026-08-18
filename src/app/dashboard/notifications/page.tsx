import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const session = getSession();
  const logs = await prisma.notificationLog.findMany({
    where: { firmId: session!.firmId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const configured = {
    whatsapp: !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN),
    email: !!process.env.SMTP_HOST,
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Notifications</h1>
      <p className="text-sm text-gray-500 mb-6">
        WhatsApp: {configured.whatsapp ? "connected" : "stub mode (set WHATSAPP_API_* in .env to go live)"} · Email:{" "}
        {configured.email ? "connected" : "stub mode (set SMTP_* in .env to go live)"}
      </p>

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">To</th>
              <th className="px-4 py-3 font-medium">Template</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-line">
                <td className="px-4 py-3">{l.channel}</td>
                <td className="px-4 py-3 text-gray-500">{l.toAddress}</td>
                <td className="px-4 py-3 text-gray-500">{l.template}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      l.status === "SENT"
                        ? "text-green-700"
                        : l.status === "FAILED"
                        ? "text-red-600"
                        : "text-gray-500"
                    }
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No notifications sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
