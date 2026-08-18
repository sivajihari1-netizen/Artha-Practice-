import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { parseGstCsv, reconcile, GstCsvParseError } from "@/lib/gstReconcile";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — CSVs, not attachments

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const reconciliations = await prisma.gstReconciliation.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      period: true,
      createdAt: true,
      matchedCount: true,
      onlyIn2bCount: true,
      onlyInBooksCount: true,
      mismatchCount: true,
    },
  });
  return NextResponse.json({ reconciliations });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const client = await prisma.client.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });

  const period = (formData.get("period") as string) || "";
  const booksFile = formData.get("booksFile");
  const gstr2bFile = formData.get("gstr2bFile");

  if (!period.trim()) {
    return NextResponse.json({ error: "Period is required (e.g. 2026-06)" }, { status: 400 });
  }
  if (!(booksFile instanceof File) || !(gstr2bFile instanceof File)) {
    return NextResponse.json({ error: "Both purchase register and GSTR-2B CSV files are required" }, { status: 400 });
  }
  if (booksFile.size > MAX_SIZE_BYTES || gstr2bFile.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Each file must be under 5 MB" }, { status: 413 });
  }

  try {
    const [booksText, gstr2bText] = await Promise.all([booksFile.text(), gstr2bFile.text()]);
    const booksRows = parseGstCsv(booksText);
    const gstr2bRows = parseGstCsv(gstr2bText);
    const { items, summary } = reconcile(booksRows, gstr2bRows);

    const created = await prisma.gstReconciliation.create({
      data: {
        clientId: client.id,
        period: period.trim(),
        createdById: auth.session.userId,
        matchedCount: summary.matched,
        onlyIn2bCount: summary.onlyIn2b,
        onlyInBooksCount: summary.onlyInBooks,
        mismatchCount: summary.mismatch,
        items: {
          create: items.map((item) => ({
            supplierGstin: item.supplierGstin,
            invoiceNumber: item.invoiceNumber,
            invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : null,
            taxableValue2b: item.taxableValue2b,
            taxableValueBooks: item.taxableValueBooks,
            taxAmount2b: item.taxAmount2b,
            taxAmountBooks: item.taxAmountBooks,
            status: item.status,
          })),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id, summary }, { status: 201 });
  } catch (err) {
    if (err instanceof GstCsvParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
