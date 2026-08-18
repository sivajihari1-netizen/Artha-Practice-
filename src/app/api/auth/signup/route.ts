import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signSession, setSessionCookie } from "@/lib/auth";
import { MCA_DEADLINE_TEMPLATES } from "@/lib/mcaTemplates";
import { ensureFirmTaskWorkflow } from "@/lib/taskWorkflow";

const signupSchema = z.object({
  firmName: z.string().min(2, "Firm name is required"),
  name: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { firmName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30);

  const firm = await prisma.firm.create({
    data: {
      name: firmName,
      users: {
        create: {
          name,
          email,
          passwordHash,
          role: "PARTNER",
        },
      },
      subscription: {
        create: {
          status: "TRIALING",
          trialEndsAt,
        },
      },
      taskTemplates: {
        create: MCA_DEADLINE_TEMPLATES,
      },
    },
    include: { users: true },
  });

  await ensureFirmTaskWorkflow(firm.id);

  const user = firm.users[0];
  const token = signSession({ userId: user.id, firmId: firm.id, role: user.role, email: user.email });
  setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
