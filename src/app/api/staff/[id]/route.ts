import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/auditLog";
import { ActivityEvent, recordActivity } from "@/lib/activity";

const updateStaffSchema = z.object({
  role: z.enum(["PARTNER", "MANAGER", "STAFF"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role !== "PARTNER") {
    return NextResponse.json({ error: "Only Partners can change staff role/status" }, { status: 403 });
  }

  const existing = await prisma.user.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

  const parsed = updateStaffSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  await logAudit({
    firmId: auth.session.firmId,
    userId: auth.session.userId,
    action: "staff.role_change",
    targetType: "User",
    targetId: user.id,
    metadata: { before: { role: existing.role, active: existing.active }, after: parsed.data },
  });

  const changedFields = Object.keys(parsed.data);
  if (changedFields.length > 0) {
    await recordActivity({
      firmId: auth.session.firmId,
      entityType: "STAFF",
      entityId: user.id,
      eventType: ActivityEvent.STAFF_UPDATED,
      title: `Staff updated: ${user.name} (${changedFields.join(", ")})`,
      actorId: auth.session.userId,
      metadata: { before: { role: existing.role, active: existing.active }, after: parsed.data },
    });
  }

  return NextResponse.json({ user });
}
