type NotificationLogEntry = {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  toAddress: string;
  template: string;
  status: "QUEUED" | "SENT" | "FAILED";
  createdAt: Date | string;
  sentAt: Date | string | null;
};

const STATUS_COLOR: Record<NotificationLogEntry["status"], string> = {
  QUEUED: "text-gray-500 bg-gray-100",
  SENT: "text-green-700 bg-green-50",
  FAILED: "text-red-700 bg-red-50",
};

/**
 * Deliberately renders only channel/recipient/template/status/timestamp —
 * never the notification's payload (full email/WhatsApp body, which can
 * carry a live reset or magic-link token) or its error text (can carry raw
 * SMTP/provider diagnostic detail). Neither field is even fetched by the
 * page query this reads from.
 */
export default function NotificationHistoryPanel({ logs }: { logs: NotificationLogEntry[] }) {
  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <h3 className="font-bold text-sm mb-3">Notification History</h3>
      {logs.length === 0 ? (
        <p className="text-xs text-gray-400">No notifications sent to this client yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <div className="font-medium">
                  {log.channel === "EMAIL" ? "Email" : "WhatsApp"} · {log.template}
                </div>
                <div className="text-xs text-gray-500">
                  {log.toAddress} · {new Date(log.sentAt ?? log.createdAt).toLocaleString("en-IN")}
                </div>
              </div>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLOR[log.status]}`}>{log.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
