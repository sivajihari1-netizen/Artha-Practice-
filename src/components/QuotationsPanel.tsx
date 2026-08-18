import Link from "next/link";
import { QUOTATION_SERVICE_TYPE_LABELS } from "@/lib/quotationPresets";

type Quotation = {
  id: string;
  quotationNumber: string;
  title: string;
  serviceType: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  issueDate: Date | string;
};

const STATUS_COLOR: Record<Quotation["status"], string> = {
  DRAFT: "text-gray-500 bg-gray-100",
  SENT: "text-blue-700 bg-blue-50",
  ACCEPTED: "text-green-700 bg-green-50",
  DECLINED: "text-red-700 bg-red-50",
  EXPIRED: "text-gray-400 bg-gray-50",
};

/** Read-only — quotations are created from the Quotations module, not from here (see P0.2: relationship before duplication). */
export default function QuotationsPanel({ quotations, totalCount }: { quotations: Quotation[]; totalCount: number }) {
  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Quotations</h3>
        {totalCount > quotations.length && <span className="text-xs text-gray-400">{quotations.length} of {totalCount}</span>}
      </div>
      {quotations.length === 0 ? (
        <p className="text-xs text-gray-400">No quotations sent to this client yet.</p>
      ) : (
        <ul className="space-y-1">
          {quotations.map((q) => (
            <li key={q.id}>
              <Link
                href={`/dashboard/quotations/${q.id}`}
                className="flex items-center justify-between gap-2 text-sm hover:bg-paper-dim -mx-2 px-2 py-1.5 rounded-md"
              >
                <div>
                  <div className="font-medium text-accent">{q.quotationNumber}</div>
                  <div className="text-xs text-gray-500">
                    {q.title} · {QUOTATION_SERVICE_TYPE_LABELS[q.serviceType as keyof typeof QUOTATION_SERVICE_TYPE_LABELS] ?? q.serviceType}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">{new Date(q.issueDate).toLocaleDateString("en-IN")}</div>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[q.status]}`}>{q.status}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
