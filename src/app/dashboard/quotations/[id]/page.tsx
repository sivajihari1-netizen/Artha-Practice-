import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import QuotationActions from "@/components/QuotationActions";
import QuotationEditForm from "@/components/QuotationEditForm";
import QuotationDocument from "@/components/QuotationDocument";
import PrintButton from "@/components/PrintButton";
import Breadcrumb from "@/components/Breadcrumb";
import type { ScopeItem, FeeItem, TermItem, StatHighlight } from "@/lib/quotationPresets";

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, firmId: session!.firmId },
    include: {
      client: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 1 } } },
      firm: true,
      // Quotation -> Invoice (P1 batch) — lets QuotationActions show "View
      // Invoice ->" once one already exists, instead of offering to create
      // a second one.
      createdInvoice: { select: { id: true, invoiceNumber: true } },
    },
  });
  if (!quotation) notFound();

  const canEdit = session!.role !== "STAFF";
  const contact = quotation.client?.contacts[0];
  const hasEmail = !!(contact?.email ?? quotation.prospectEmail);
  const hasPhone = !!(contact?.phone ?? quotation.prospectPhone);
  const shareLink = `${process.env.APP_URL ?? "https://arthapractice.in"}/quotation/${quotation.publicToken}`;
  const clientName = quotation.client?.name ?? quotation.prospectName ?? "Prospect";

  return (
    <div>
      <div className="print:hidden">
        <Breadcrumb items={[{ label: "Money", href: "/dashboard/quotations" }, { label: "Quotations", href: "/dashboard/quotations" }, { label: quotation.quotationNumber }]} />
      </div>
      <div className="print:hidden mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{quotation.quotationNumber}</h1>
          <p className="text-sm text-gray-500">
            {quotation.client ? (
              <Link href={`/dashboard/clients/${quotation.client.id}`} className="text-accent hover:underline">
                {clientName}
              </Link>
            ) : (
              clientName
            )}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="print:hidden mb-5">
        <QuotationActions
          quotationId={quotation.id}
          status={quotation.status}
          hasEmail={hasEmail}
          hasPhone={hasPhone}
          shareLink={shareLink}
          clientId={quotation.clientId}
          createdInvoice={quotation.createdInvoice}
        />
      </div>

      <div className="print:hidden mb-8">
        <QuotationEditForm
          canEdit={canEdit}
          quotation={{
            id: quotation.id,
            title: quotation.title,
            subtitle: quotation.subtitle,
            preparedByName: quotation.preparedByName,
            introNote: quotation.introNote,
            validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
            statHighlights: quotation.statHighlights as unknown as StatHighlight[],
            aboutPoints: quotation.aboutPoints as unknown as ScopeItem[],
            scopeItems: quotation.scopeItems as unknown as ScopeItem[],
            feeItems: quotation.feeItems as unknown as FeeItem[],
            termsItems: quotation.termsItems as unknown as TermItem[],
          }}
        />
      </div>

      <p className="print:hidden text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview</p>
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
      />
    </div>
  );
}
