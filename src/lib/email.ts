import { prisma } from "@/lib/prisma";

/**
 * Sends an email and logs it to NotificationLog. Stub mode (no SMTP_HOST
 * configured) just logs to the console. Configure SMTP_HOST/PORT/USER/PASS
 * in .env (or swap this for Resend/SendGrid's SDK) to send for real.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  firmId?: string;
  /** Which client this notification is about, if any — lets a client's detail page show its own notification history. */
  clientId?: string;
  /** Which task triggered this send, if any (e.g. a due-date reminder) — distinct from clientId since not every notification is task-driven. */
  sourceTaskId?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const { to, subject, body, firmId, clientId, sourceTaskId, attachments } = params;
  const configured = !!process.env.SMTP_HOST;

  const log = await prisma.notificationLog.create({
    data: {
      firmId,
      clientId,
      sourceTaskId,
      channel: "EMAIL",
      toAddress: to,
      template: subject,
      payload: { body },
      status: "QUEUED",
    },
  });

  if (!configured) {
    console.log(`[email:stub] Would send "${subject}" to ${to}`);
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date() } });
    return { ok: true, stub: true };
  }

  try {
    // Lazy-import so `nodemailer` is only required when SMTP is actually configured.
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 is implicit TLS; anything else (587, 25) negotiates STARTTLS instead.
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // Default is 2 minutes, which left a user staring at "Sending…" the
      // full 2 minutes when an outbound port is silently blocked (connection
      // hangs instead of failing fast) rather than surfacing an error quickly.
      connectionTimeout: 10_000,
    });
    await transport.sendMail({ from: process.env.EMAIL_FROM, to, subject, html: body, attachments });
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date() } });
    return { ok: true };
  } catch (err: any) {
    await prisma.notificationLog.update({ where: { id: log.id }, data: { status: "FAILED", error: String(err) } });
    return { ok: false, error: String(err) };
  }
}
