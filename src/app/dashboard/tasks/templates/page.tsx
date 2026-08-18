import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TaskTemplatesPanel from "@/components/TaskTemplatesPanel";
import Breadcrumb from "@/components/Breadcrumb";

export default async function TaskTemplatesPage() {
  const session = getSession();
  const templates = await prisma.taskTemplate.findMany({
    where: { firmId: session!.firmId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div>
      <Breadcrumb items={[{ label: "Work", href: "/dashboard/tasks" }, { label: "Task Templates" }]} />
      <TaskTemplatesPanel templates={templates} />
    </div>
  );
}
