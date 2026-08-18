import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";

// "ANNUAL:MM-DD" is a fixed statutory deadline (e.g. "ANNUAL:09-30" for DIR-3
// KYC, due every Sep 30) rather than a rolling period — see recurringTasks.ts.
const recurrenceSchema = z.string().refine(
  (v) => ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"].includes(v.toUpperCase()) || /^ANNUAL:\d{2}-\d{2}$/i.test(v),
  { message: "Recurrence must be WEEKLY, MONTHLY, QUARTERLY, ANNUAL, or ANNUAL:MM-DD" }
);

const createTemplateSchema = z.object({
  title: z.string().min(1),
  returnType: z.enum(["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"]).default("OTHER"),
  recurrence: recurrenceSchema,
  checklist: z.array(z.string()).optional(),
});

export async function GET() {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  const templates = await prisma.taskTemplate.findMany({ where: { firmId: auth.session.firmId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const auth = requireSession();
  if ("error" in auth) return auth.error;
  if (auth.session.role === "STAFF") {
    return NextResponse.json({ error: "Only Partners/Managers can create task templates" }, { status: 403 });
  }

  const parsed = createTemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const template = await prisma.taskTemplate.create({ data: { ...parsed.data, firmId: auth.session.firmId } });
  return NextResponse.json({ template }, { status: 201 });
}
