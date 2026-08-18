import { prisma } from "@/lib/prisma";

/**
 * Sends a WhatsApp message and logs the attempt to NotificationLog.
 *
 * In "stub mode" (no WHATSAPP_API_TOKEN configured) this just logs the
 * message to the console and records it as SENT so the rest of the app
 * (UI, dedupe logic) behaves exactly like production. Once you have a
 * WhatsApp Business API account — either Meta's Cloud API directly, or a
 * BSP like Gupshup/Twilio/Interakt — set WHATSAPP_API_URL,
 * WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env and real messages
 * will be sent instead.
 *
 * `templateName` should match an approved WhatsApp message template name —
 * WhatsApp Business API requires pre-approved templates for
 * business-initiated conversations (you cannot free-form message a client
 * who hasn't messaged you in the last 24h).
 */
export async function sendWhatsAppMessage(params: {
  to: string; // E.164 phone number, e.g. +919567913081
  templateName: string;
  variables?: Record<string, string>;
  firmId?: string;
  /** Which client this notification is about, if any — lets a client's detail page show its own notification history. */
  clientId?: string;
  /** Which task triggered this send, if any (e.g. a due-date reminder) — distinct from clientId since not every notification is task-driven. */
  sourceTaskId?: string;
}) {
  const { to, templateName, variables = {}, firmId, clientId, sourceTaskId } = params;
  const configured = !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);

  const log = await prisma.notificationLog.create({
    data: {
      firmId,
      clientId,
      sourceTaskId,
      channel: "WHATSAPP",
      toAddress: to,
      template: templateName,
      payload: variables,
      status: "QUEUED",
    },
  });

  if (!configured) {
    console.log(`[whatsapp:stub] Would send "${templateName}" to ${to}`, variables);
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date() } });
    return { ok: true, stub: true };
  }

  try {
    const res = await fetch(process.env.WHATSAPP_API_URL!, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: Object.values(variables).map((v) => ({ type: "text", text: v })),
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "FAILED", error: errText } });
      return { ok: false, error: errText };
    }

    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date() } });
    return { ok: true };
  } catch (err: any) {
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "FAILED", error: String(err) } });
    return { ok: false, error: String(err) };
  }
}
