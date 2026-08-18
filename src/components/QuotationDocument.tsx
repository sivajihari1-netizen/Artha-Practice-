import { inter } from "@/lib/fonts";
import { sanitizeBrandColor } from "@/lib/color";
import type { ScopeItem, FeeItem, TermItem, StatHighlight } from "@/lib/quotationPresets";

export type QuotationDocumentData = {
  quotationNumber: string;
  status: string;
  title: string;
  subtitle: string | null;
  preparedByName: string | null;
  introNote: string | null;
  statHighlights: StatHighlight[];
  aboutPoints: ScopeItem[];
  scopeItems: ScopeItem[];
  feeItems: FeeItem[];
  termsItems: TermItem[];
  issueDate: Date;
  validUntil: Date | null;
  acceptedAt: Date | null;
  acceptedByName: string | null;
  firm: {
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    showCaTagline: boolean;
    brandColor: string;
  };
  clientName: string;
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENT: "bg-slate-50 text-inv-primary",
  ACCEPTED: "bg-green-50 text-inv-success",
  DECLINED: "bg-red-50 text-red-600",
  EXPIRED: "bg-slate-100 text-slate-400",
};

function fmtDate(d: Date | null): string {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function firmInitials(name: string): string {
  const words = name.replace(/[^\w\s&]/g, "").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

export default function QuotationDocument({ quotation, children }: { quotation: QuotationDocumentData; children?: React.ReactNode }) {
  const { firm } = quotation;
  const feeTotalByFrequency = new Map<string, number>();
  for (const item of quotation.feeItems) {
    feeTotalByFrequency.set(item.frequency, (feeTotalByFrequency.get(item.frequency) ?? 0) + item.fee);
  }

  return (
    <div
      style={{ "--brand-primary": sanitizeBrandColor(firm.brandColor) } as React.CSSProperties}
      className={`${inter.className} max-w-[820px] mx-auto bg-white rounded-xl border border-inv-border shadow-sm print:shadow-none print:border-0 print:rounded-none text-inv-accent overflow-hidden`}
    >
      {/* Cover */}
      <div className="bg-inv-primary text-white p-8 sm:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm shrink-0">
            {firmInitials(firm.name)}
          </div>
          <div>
            <div className="font-extrabold text-lg leading-tight">{firm.name}</div>
            {firm.showCaTagline && <div className="text-xs font-medium text-white/80">Chartered Accountants</div>}
          </div>
        </div>
        <div className="text-xs uppercase tracking-wide text-white/70 mb-2">{quotation.subtitle || "Professional Services Proposal"}</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight max-w-lg">{quotation.title}</h1>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-6 text-xs text-white/80">
          <div>Prepared for <span className="font-semibold text-white">{quotation.clientName}</span></div>
          {quotation.preparedByName && <div>By <span className="font-semibold text-white">{quotation.preparedByName}</span></div>}
          <div>{quotation.quotationNumber}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-2 text-xs text-white/70">
          <div>Issued {fmtDate(quotation.issueDate)}</div>
          {quotation.validUntil && <div>Valid until {fmtDate(quotation.validUntil)}</div>}
          <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[quotation.status] ?? STATUS_STYLE.DRAFT}`}>
            {quotation.status}
          </span>
        </div>
      </div>

      <div className="p-8 sm:p-10">
        {/* Intro / About */}
        {quotation.introNote && (
          <p className="text-sm text-inv-accent/80 leading-relaxed mb-8 whitespace-pre-line">{quotation.introNote}</p>
        )}

        {quotation.statHighlights.filter((s) => s.value.trim()).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {quotation.statHighlights.filter((s) => s.value.trim()).map((s, i) => (
              <div key={i} className="bg-inv-secondary rounded-xl border border-inv-border p-4 text-center">
                <div className="text-xl font-extrabold text-inv-primary">{s.value}</div>
                <div className="text-[11px] text-inv-accent/60 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {quotation.aboutPoints.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {quotation.aboutPoints.map((p, i) => (
              <div key={i}>
                <div className="font-bold text-sm mb-0.5">{p.title}</div>
                <div className="text-xs text-inv-accent/60">{p.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Scope of Services */}
        {quotation.scopeItems.length > 0 && (
          <div className="mb-10">
            <div className="text-[11px] font-semibold text-inv-primary uppercase tracking-wide mb-3">Scope of Services</div>
            <div className="space-y-3">
              {quotation.scopeItems.map((item, i) => (
                <div key={i} className="flex gap-4 bg-inv-secondary rounded-xl border border-inv-border p-4">
                  <div className="text-lg font-extrabold text-inv-primary/40 w-8 shrink-0">{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="font-bold text-sm">{item.title}</div>
                    <div className="text-xs text-inv-accent/60 mt-0.5">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fee */}
        {quotation.feeItems.length > 0 && (
          <div className="mb-10">
            <div className="text-[11px] font-semibold text-inv-primary uppercase tracking-wide mb-3">Our Fee</div>
            <div className="rounded-xl border border-inv-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-inv-secondary text-[11px] uppercase tracking-wide text-inv-accent/60">
                  <tr>
                    <th className="text-left font-semibold py-3 px-4">Particulars</th>
                    <th className="text-right font-semibold py-3 px-4 w-32">Fee</th>
                    <th className="text-right font-semibold py-3 px-4 w-32">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.feeItems.map((item, i) => (
                    <tr key={i} className="border-t border-inv-border">
                      <td className="py-3 px-4">{item.particulars}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmtInr(item.fee)}</td>
                      <td className="py-3 px-4 text-right text-inv-accent/60">{item.frequency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {feeTotalByFrequency.size > 0 && (
              <div className="flex flex-wrap justify-end gap-x-6 mt-2 text-xs text-inv-accent/60">
                {[...feeTotalByFrequency.entries()].map(([freq, total]) => (
                  <div key={freq}>Total {freq}: <span className="font-bold text-inv-primary">{fmtInr(total)}</span></div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-inv-accent/40 mt-2">Fees stated are exclusive of applicable GST.</p>
          </div>
        )}

        {/* Terms */}
        {quotation.termsItems.length > 0 && (
          <div className="mb-8">
            <div className="text-[11px] font-semibold text-inv-primary uppercase tracking-wide mb-3">Terms &amp; Conditions</div>
            <div className="divide-y divide-inv-border border border-inv-border rounded-xl overflow-hidden">
              {quotation.termsItems.map((t, i) => (
                <div key={i} className={`grid sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 p-4 text-xs ${i % 2 === 1 ? "bg-inv-secondary" : ""}`}>
                  <div className="font-bold">{t.label}</div>
                  <div className="text-inv-accent/60">{t.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {quotation.acceptedAt && (
          <div className="mb-8 text-xs text-inv-success font-medium">
            Accepted by {quotation.acceptedByName || quotation.clientName} on {fmtDate(quotation.acceptedAt)}
          </div>
        )}

        {children}

        {/* Footer */}
        <div className="pt-6 border-t border-inv-border text-center text-[11px] text-inv-accent/40 space-y-0.5">
          <div>This is a computer-generated proposal.</div>
          {(firm.website || firm.email || firm.phone) && (
            <div>{[firm.phone, firm.email, firm.website].filter(Boolean).join(" · ")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
