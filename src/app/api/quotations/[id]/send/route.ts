import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { renderQuotationPdf } from "@/lib/quotationPdf";
import { sendEmail } from "@/lib/email";

const INCLUDE = {
  client: { include: { contacts: { where: { email: { not: null } }, orderBy: { isPrimary: "desc" as const }, take: 1 } } },
  firm: true,
};

/** Emails the quotation PDF to the client's primary contact, or the prospect's email. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can send quotations" }, { status: 403 });
  }

  let quotation = await prisma.quotation.findFirst({ where: { id: params.id, firmId: auth.session.firmId }, include: INCLUDE });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipientEmail = quotation.client?.contacts[0]?.email ?? quotation.prospectEmail;
  if (!recipientEmail) {
    return NextResponse.json({ error: "No email on file for this client/prospect" }, { status: 400 });
  }

  if (quotation.status === "DRAFT") {
    quotation = await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "SENT" }, include: INCLUDE });
  }

  const clientName = quotation.client?.name ?? quotation.prospectName ?? "there";
  const link = `${process.env.APP_URL ?? "https://arthapractice.in"}/quotation/${quotation.publicToken}`;
  const pdfBuffer = await renderQuotationPdf({
    ...quotation,
    statHighlights: quotation.statHighlights as never,
    aboutPoints: quotation.aboutPoints as never,
    scopeItems: quotation.scopeItems as never,
    feeItems: quotation.feeItems as never,
    termsItems: quotation.termsItems as never,
    clientName,
  });

  const result = await sendEmail({
    to: recipientEmail,
    subject: `Proposal: ${quotation.title} — ${quotation.firm.name}`,
    body: `<p>Dear ${clientName},</p><p>Please find attached our proposal <strong>${quotation.title}</strong> (${quotation.quotationNumber}).</p><p>View and respond online: <a href="${link}">${link}</a></p><p>Regards,<br/>${quotation.firm.name}</p>`,
    firmId: auth.session.firmId,
    attachments: [{ filename: `${quotation.quotationNumber.replace(/\//g, "-")}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
  }

  const updated = await prisma.quotation.update({ where: { id: quotation.id }, data: { emailedAt: new Date() } });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "quotation.email_sent",
    targetType: "Quotation",
    targetId: quotation.id,
    metadata: { quotationNumber: quotation.quotationNumber, to: recipientEmail },
  });

  return NextResponse.json({ ok: true, quotation: updated, sentTo: recipientEmail });
}
