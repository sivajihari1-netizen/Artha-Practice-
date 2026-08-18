import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

const createLeaveSchema = z.object({
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  reason: z.string().optional(),
});

export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const where =
    auth.session.role === "STAFF"
      ? { userId: auth.session.userId }
      : { user: { firmId: auth.session.firmId } };

  const requests = await prisma.leaveRequest.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;

  const parsed = createLeaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { fromDate, toDate, reason } = parsed.data;

  const request = await prisma.leaveRequest.create({
    data: { userId: auth.session.userId, fromDate: new Date(fromDate), toDate: new Date(toDate), reason },
  });
  return NextResponse.json({ request }, { status: 201 });
}
