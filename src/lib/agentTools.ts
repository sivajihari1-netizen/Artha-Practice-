// Real implementations of the 5 named agent tools, backed by Prisma and the
// real WhatsApp sender. Every agent gets a narrow, explicitly-named tool set
// (see src/lib/agents.ts — no general-purpose unrestricted-tool agent).
// draft_whatsapp_reply sends for real (through the existing stub-mode-aware
// sendWhatsAppMessage) rather than just composing text, since WhatsApp
// Business API requires a pre-approved template for business-initiated
// messages — there's no such thing as a freeform "draft" that later gets
// sent as-is.

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export type ClientTaskStatus = { taskId: string; title: string; dueDate: string | null; status: string };
export type ClientHistory = { avgDaysLate: number; missedDeadlinesLast12mo: number; whatsappResponsive: boolean };
export type DocumentChecklistItem = { label: string; fulfilled: boolean };

export async function get_client_task_status(client_id: string): Promise<ClientTaskStatus[]> {
  const tasks = await prisma.task.findMany({
    where: { clientId: client_id },
    orderBy: { dueDate: "asc" },
    take: 10,
  });
  return tasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    status: t.status,
  }));
}

export async function get_client_history(client_id: string): Promise<ClientHistory> {
  const twelveMonthsAgo = new Date(Date.now() - 365 * 86400000);
  const doneTasks = await prisma.task.findMany({
    where: { clientId: client_id, status: "DONE", dueDate: { not: null, gte: twelveMonthsAgo } },
    select: { dueDate: true, updatedAt: true },
  });

  const daysLate = doneTasks.map((t) => Math.max(0, Math.ceil((t.updatedAt.getTime() - t.dueDate!.getTime()) / 86400000)));
  const avgDaysLate = daysLate.length ? Math.round((daysLate.reduce((a, b) => a + b, 0) / daysLate.length) * 10) / 10 : 0;
  const missedDeadlinesLast12mo = daysLate.filter((d) => d > 0).length;

  // NotificationLog is outbound-only (no delivery-read/reply tracking), so
  // "responsive" here is really "reachable" — did the client's most recent
  // WhatsApp send actually go through, not whether they replied to it.
  const contact = await prisma.contactPerson.findFirst({ where: { clientId: client_id, isPrimary: true } });
  let whatsappResponsive = false;
  if (contact?.phone) {
    const lastSend = await prisma.notificationLog.findFirst({
      where: { channel: "WHATSAPP", toAddress: contact.phone },
      orderBy: { createdAt: "desc" },
    });
    whatsappResponsive = !lastSend || lastSend.status === "SENT";
  }

  return { avgDaysLate, missedDeadlinesLast12mo, whatsappResponsive };
}

export async function get_document_checklist(client_id: string): Promise<DocumentChecklistItem[]> {
  const request = await prisma.documentRequest.findFirst({
    where: { clientId: client_id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!request) return [];
  return request.items.map((i) => ({ label: i.label, fulfilled: i.fulfilled }));
}

export async function draft_whatsapp_reply(
  client_id: string,
  category: "status_update" | "reminder" | "notice_response",
  context: string
): Promise<{ sent: boolean; preview: string; reason?: string }> {
  const preview =
    category === "reminder"
      ? `Reminder: ${context}`
      : category === "notice_response"
      ? `Regarding the notice you received: ${context}`
      : `Update: ${context}`;

  const [contact, client] = await Promise.all([
    prisma.contactPerson.findFirst({ where: { clientId: client_id, isPrimary: true } }),
    prisma.client.findUnique({ where: { id: client_id }, select: { name: true, firmId: true } }),
  ]);

  if (!contact?.phone || !client) {
    return { sent: false, preview, reason: "No WhatsApp-capable contact on file for this client" };
  }

  // These template names must be pre-approved with the WhatsApp Business API
  // provider before going live — see README's "Going live with each
  // integration" section. sendWhatsAppMessage runs in stub mode (logs +
  // records a SENT NotificationLog) until WHATSAPP_API_* is configured.
  const templateName =
    category === "reminder" ? "document_chase_reminder" : category === "notice_response" ? "notice_response_update" : "client_status_update";

  const result = await sendWhatsAppMessage({
    to: contact.phone,
    templateName,
    variables: { client_name: client.name, message: context },
    firmId: client.firmId,
  });

  return { sent: result.ok, preview, reason: result.ok ? undefined : "error" in result ? result.error : "send failed" };
}

export function flag_for_staff_review(client_id: string, reason: string, suggested_action: string) {
  return { client_id, reason, suggested_action };
}
