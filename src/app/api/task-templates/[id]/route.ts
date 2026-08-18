import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

// Duplicated from ../route.ts (4 lines) rather than exported/shared across
// the two route files — Next.js route modules only reliably expose HTTP
// method handlers, so re-exporting a plain const risks build-time route
// validation. Same tradeoff already made for MCA_TEMPLATES in the panel.
const recurrenceSchema = z.string().refine(
  (v) => ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"].includes(v.toUpperCase()) || /^ANNUAL:\d{2}-\d{2}$/i.test(v),
  { message: "Recurrence must be WEEKLY, MONTHLY, QUARTERLY, ANNUAL, or ANNUAL:MM-DD" }
);

const updateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  returnType: z.enum(["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"]).optional(),
  recurrence: recurrenceSchema.optional(),
  checklist: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can edit task templates" }, { status: 403 });
  }

  const existing = await prisma.taskTemplate.findFirst({ where: { id: params.id, firmId: auth.session.firmId } });
  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const parsed = updateTemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const template = await prisma.taskTemplate.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ template });
}
