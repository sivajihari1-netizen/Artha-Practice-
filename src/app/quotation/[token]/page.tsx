import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import QuotationDocument from "@/components/QuotationDocument";
import QuotationAcceptForm from "@/components/QuotationAcceptForm";
import PrintButton from "@/components/PrintButton";
import type { ScopeItem, FeeItem, TermItem, StatHighlight } from "@/lib/quotationPresets";

export default async function PublicQuotationPage({ params }: { params: { token: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { publicToken: params.token },
    include: { client: true, firm: true },
  });
  if (!quotation) notFound();

  const clientName = quotation.client?.name ?? quotation.prospectName ?? "Prospect";
  const pending = quotation.status !== "ACCEPTED" && quotation.status !== "DECLINED" && quotation.status !== "EXPIRED";

  return (
    <div className="min-h-screen bg-paper py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-[820px] mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="text-lg font-extrabold text-inv-accent">
          Artha<span className="text-inv-primary">.</span>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/public/quotations/${params.token}/pdf`}
            className="border border-inv-border rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-inv-secondary"
          >
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <QuotationDocument
        quotation={{
          quotationNumber: quotation.quotationNumber,
          status: quotation.status,
          title: quotation.title,
          subtitle: quotation.subtitle,
          preparedByName: quotation.preparedByName,
          introNote: quotation.introNote,
          statHighlights: quotation.statHighlights as unknown as StatHighlight[],
          aboutPoints: quotation.aboutPoints as unknown as ScopeItem[],
          scopeItems: quotation.scopeItems as unknown as ScopeItem[],
          feeItems: quotation.feeItems as unknown as FeeItem[],
          termsItems: quotation.termsItems as unknown as TermItem[],
          issueDate: quotation.issueDate,
          validUntil: quotation.validUntil,
          acceptedAt: quotation.acceptedAt,
          acceptedByName: quotation.acceptedByName,
          firm: quotation.firm,
          clientName,
        }}
      >
        {pending && <QuotationAcceptForm token={params.token} />}
        {quotation.status === "DECLINED" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 print:hidden">This proposal was declined.</div>
        )}
        {quotation.status === "EXPIRED" && (
          <div className="rounded-xl border border-inv-border bg-inv-secondary p-4 text-sm text-inv-accent/60 print:hidden">This proposal has expired. Please contact us for an updated quotation.</div>
        )}
      </QuotationDocument>
    </div>
  );
}
