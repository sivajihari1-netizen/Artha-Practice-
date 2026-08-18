import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const request = await prisma.documentRequest.findFirst({
    where: { id: params.id, firmId: auth.session.firmId },
    include: {
      client: { include: { contacts: { where: { isPrimary: true }, take: 1 } } },
      items: true,
    },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contact = request.client.contacts[0];
  if (!contact?.phone) {
    return NextResponse.json({ error: "Client has no primary contact phone number" }, { status: 400 });
  }

  const pendingLabels = request.items.filter((i) => !i.fulfilled).map((i) => i.label);
  const uploadUrl = `${process.env.APP_URL ?? "https://arthapractice.in"}/upload/${request.token}`;

  await sendWhatsAppMessage({
    to: contact.phone,
    templateName: "document_request_reminder",
    variables: {
      client_name: request.client.name,
      items: pendingLabels.join(", "),
      link: uploadUrl,
    },
    firmId: auth.session.firmId,
  });

  return NextResponse.json({ ok: true });
}
