import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LeadsBoard from "@/components/LeadsBoard";

export default async function LeadsPage() {
  const session = getSession();
  const leads = await prisma.lead.findMany({
    where: { firmId: session!.firmId },
    orderBy: { createdAt: "desc" },
  });
  return <LeadsBoard leads={leads as any} />;
}
