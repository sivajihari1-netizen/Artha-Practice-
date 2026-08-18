import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { renderQuotationPdf } from "@/lib/quotationPdf";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: { client: { select: { name: true } }, firm: true },
  });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderQuotationPdf({
    ...quotation,
    statHighlights: quotation.statHighlights as never,
    aboutPoints: quotation.aboutPoints as never,
    scopeItems: quotation.scopeItems as never,
    feeItems: quotation.feeItems as never,
    termsItems: quotation.termsItems as never,
    clientName: quotation.client?.name ?? quotation.prospectName ?? "Prospect",
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quotation.quotationNumber.replace(/\//g, "-")}.pdf"`,
    },
  });
}
