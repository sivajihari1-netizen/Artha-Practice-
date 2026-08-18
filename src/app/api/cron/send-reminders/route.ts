import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/email";
import { ensureInvoicePaymentLink } from "@/lib/invoicePayment";
import { generatePublicToken } from "@/lib/invoice";

// Sends due-date/overdue reminders to clients — for both compliance tasks
// and unpaid invoices (with a "Pay Now" link when the firm has Razorpay
// connected). Trigger daily from an external scheduler, protected by
// CRON_SECRET. Idempotent: each Task/Invoice tracks lastReminderSentAt so
// re-running the cron (or a scheduler double-fire) never double-sends.
//
// Vercel Cron example (vercel.json):
// { "crons": [{ "path": "/api/cron/send-reminders", "schedule": "0 4 * * *" }] }
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const DUE_SOON_COOLDOWN_MS = 20 * 60 * 60 * 1000; // ~20h — caps to at most once/day even with cron jitter
  const OVERDUE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // nag overdue invoices every 3 days, not daily

  // ---- Task due-date reminders ----
  const dueSoonTasks = await prisma.task.findMany({
    where: { status: { not: "DONE" }, dueDate: { gte: now, lte: windowEnd }, clientId: { not: null } },
    include: { client: { include: { contacts: { where: { isPrimary: true }, take: 1 } } } },
  });

  let taskWhatsappSent = 0, taskEmailSent = 0, taskSkipped = 0;
  for (const task of dueSoonTasks) {
    if (task.lastReminderSentAt && now.getTime() - task.lastReminderSentAt.getTime() < DUE_SOON_COOLDOWN_MS) {
      taskSkipped++;
      continue;
    }
    const contact = task.client?.contacts[0];
    if (!contact) continue;

    const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-IN") : "";
    let sentAny = false;

    if (contact.phone) {
      const result = await sendWhatsAppMessage({
        to: contact.phone,
        templateName: "task_due_reminder",
        variables: { client_name: task.client!.name, task_title: task.title, due_date: dueDateStr },
        firmId: task.firmId,
        clientId: task.clientId ?? undefined,
        sourceTaskId: task.id,
      });
      if (result.ok) { taskWhatsappSent++; sentAny = true; }
    }

    if (contact.email) {
      const result = await sendEmail({
        to: contact.email,
        subject: `Reminder: ${task.title} due ${dueDateStr}`,
        body: `<p>Hi ${contact.name},</p><p>This is a reminder that <strong>${task.title}</strong> for <strong>${task.client!.name}</strong> is due on ${dueDateStr}.</p>`,
        firmId: task.firmId,
        clientId: task.clientId ?? undefined,
        sourceTaskId: task.id,
      });
      if (result.ok) { taskEmailSent++; sentAny = true; }
    }

    if (sentAny) await prisma.task.update({ where: { id: task.id }, data: { lastReminderSentAt: now } });
  }

  // ---- Auto-transition SENT invoices past their due date to OVERDUE ----
  const overdueTransition = await prisma.invoice.updateMany({
    where: { status: "SENT", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });

  // ---- Invoice due-soon / overdue payment reminders ----
  const invoicesNeedingReminder = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE"] }, dueDate: { lte: windowEnd } },
    include: {
      client: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 1 } } },
      firm: { select: { name: true, razorpayKeyId: true } },
    },
  });

  let invoiceWhatsappSent = 0, invoiceEmailSent = 0, invoiceSkipped = 0;
  for (const invoice of invoicesNeedingReminder) {
    const cooldown = invoice.status === "OVERDUE" ? OVERDUE_COOLDOWN_MS : DUE_SOON_COOLDOWN_MS;
    if (invoice.lastReminderSentAt && now.getTime() - invoice.lastReminderSentAt.getTime() < cooldown) {
      invoiceSkipped++;
      continue;
    }
    const contact = invoice.client.contacts[0];
    if (!contact) continue;

    if (!invoice.publicToken) {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { publicToken: generatePublicToken() } });
    }
    const paymentLinkUrl = invoice.firm.razorpayKeyId ? await ensureInvoicePaymentLink(invoice.id) : null;
    const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "";
    const amountStr = `₹${invoice.total.toLocaleString("en-IN")}`;
    let sentAny = false;

    if (contact.phone) {
      const result = await sendWhatsAppMessage({
        to: contact.phone,
        templateName: invoice.status === "OVERDUE" ? "invoice_overdue_reminder" : "invoice_due_reminder",
        variables: {
          client_name: invoice.client.name,
          invoice_number: invoice.invoiceNumber,
          amount: amountStr,
          due_date: dueDateStr,
          ...(paymentLinkUrl ? { pay_link: paymentLinkUrl } : {}),
        },
        firmId: invoice.firmId,
        clientId: invoice.clientId,
      });
      if (result.ok) { invoiceWhatsappSent++; sentAny = true; }
    }

    if (contact.email) {
      const overdue = invoice.status === "OVERDUE";
      const result = await sendEmail({
        to: contact.email,
        subject: overdue
          ? `Overdue: Invoice ${invoice.invoiceNumber} — ${amountStr}`
          : `Reminder: Invoice ${invoice.invoiceNumber} due ${dueDateStr}`,
        body: `<p>Hi ${contact.name},</p><p>${overdue ? `Invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amountStr}</strong> was due on ${dueDateStr} and is now overdue.` : `Invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amountStr}</strong> is due on ${dueDateStr}.`}</p>${paymentLinkUrl ? `<p><a href="${paymentLinkUrl}"><strong>Pay Now Online</strong></a></p>` : ""}<p>Regards,<br/>${invoice.firm.name}</p>`,
        firmId: invoice.firmId,
        clientId: invoice.clientId,
      });
      if (result.ok) { invoiceEmailSent++; sentAny = true; }
    }

    if (sentAny) await prisma.invoice.update({ where: { id: invoice.id }, data: { lastReminderSentAt: now } });
  }

  return NextResponse.json({
    ok: true,
    tasksChecked: dueSoonTasks.length,
    taskWhatsappSent,
    taskEmailSent,
    taskSkipped,
    invoicesTransitionedToOverdue: overdueTransition.count,
    invoicesChecked: invoicesNeedingReminder.length,
    invoiceWhatsappSent,
    invoiceEmailSent,
    invoiceSkipped,
  });
}
