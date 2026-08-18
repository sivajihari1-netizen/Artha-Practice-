import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

// GET: today's attendance status for the logged-in user + firm-wide log (Partner/Manager).
export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const myOpenLog = await prisma.attendanceLog.findFirst({
    where: { userId: auth.session.userId, checkIn: { gte: startOfToday }, checkOut: null },
    orderBy: { checkIn: "desc" },
  });

  const firmLogs =
    auth.session.role === "STAFF"
      ? []
      : await prisma.attendanceLog.findMany({
          where: { user: { firmId: auth.session.firmId }, checkIn: { gte: startOfToday } },
          include: { user: { select: { name: true } } },
          orderBy: { checkIn: "desc" },
        });

  return NextResponse.json({ myOpenLog, firmLogs });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const action = body?.action; // "checkin" | "checkout"

  if (action === "checkin") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const existingOpen = await prisma.attendanceLog.findFirst({
      where: { userId: auth.session.userId, checkIn: { gte: startOfToday }, checkOut: null },
    });
    if (existingOpen) return NextResponse.json({ error: "Already checked in" }, { status: 409 });

    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const log = await prisma.attendanceLog.create({
      data: { userId: auth.session.userId, checkIn: new Date(), ipAddress: ip },
    });
    return NextResponse.json({ log }, { status: 201 });
  }

  if (action === "checkout") {
    const openLog = await prisma.attendanceLog.findFirst({
      where: { userId: auth.session.userId, checkOut: null },
      orderBy: { checkIn: "desc" },
    });
    if (!openLog) return NextResponse.json({ error: "No open check-in found" }, { status: 409 });

    const log = await prisma.attendanceLog.update({ where: { id: openLog.id }, data: { checkOut: new Date() } });
    return NextResponse.json({ log });
  }

  return NextResponse.json({ error: "action must be 'checkin' or 'checkout'" }, { status: 400 });
}
