import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

const INCLUDE = {
  client: { include: { contacts: { where: { phone: { not: null } }, orderBy: { isPrimary: "desc" as const }, take: 1 } } },
  firm: { select: { name: true } },
};

/** Shares the quotation's public link with the client's primary contact, or the prospect's phone, over WhatsApp. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can send quotations" }, { status: 403 });
  }

  let quotation = await prisma.quotation.findFirst({ where: { id: params.id, firmId: auth.session.firmId }, include: INCLUDE });
  if (!quotation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipientPhone = quotation.client?.contacts[0]?.phone ?? quotation.prospectPhone;
  if (!recipientPhone) {
    return NextResponse.json({ error: "No phone number on file for this client/prospect" }, { status: 400 });
  }

  if (quotation.status === "DRAFT") {
    quotation = await prisma.quotation.update({ where: { id: quotation.id }, data: { status: "SENT" }, include: INCLUDE });
  }

  const clientName = quotation.client?.name ?? quotation.prospectName ?? "there";
  const link = `${process.env.APP_URL ?? "https://arthapractice.in"}/quotation/${quotation.publicToken}`;

  const result = await sendWhatsAppMessage({
    to: recipientPhone,
    templateName: "quotation_share",
    variables: { client_name: clientName, quotation_title: quotation.title, link },
    firmId: auth.session.firmId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 502 });
  }

  const updated = await prisma.quotation.update({ where: { id: quotation.id }, data: { whatsappSentAt: new Date() } });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "quotation.whatsapp_sent",
    targetType: "Quotation",
    targetId: quotation.id,
    metadata: { quotationNumber: quotation.quotationNumber, to: recipientPhone },
  });

  return NextResponse.json({ ok: true, quotation: updated, sentTo: recipientPhone, link });
}
