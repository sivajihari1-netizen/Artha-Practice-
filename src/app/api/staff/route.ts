import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { hashPassword } from "@/lib/auth";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const createStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["MANAGER", "STAFF"]).default("STAFF"),
});

export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  const staff = await prisma.user.findMany({
    where: { firmId: auth.session.firmId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role !== "PARTNER") {
    return NextResponse.json({ error: "Only Partners can add staff accounts" }, { status: 403 });
  }

  const parsed = createStaffSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { firmId: auth.session.firmId, name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  await recordActivity({
    firmId: auth.session.firmId,
    entityType: "STAFF",
    entityId: user.id,
    eventType: ActivityEvent.STAFF_CREATED,
    title: `Staff account created: ${user.name}`,
    actorId: auth.session.userId,
    metadata: { role: user.role },
  });

  return NextResponse.json({ user }, { status: 201 });
}
