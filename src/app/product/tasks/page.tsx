import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { DepthShell } from "@/components/marketing/DepthShell";
import { TasksBody } from "@/components/marketing/depth/ProductBodies";

export const metadata: Metadata = {
  title: "Tasks — Artha CA Practice Management",
  description:
    "Recurring GST, TDS and ITR work auto-created, on a Kanban board with owner, due date and priority.",
  alternates: { canonical: "https://arthapractice.in/product/tasks" },
};

export default function TasksProductPage() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <DepthShell>
        <TasksBody />
      </DepthShell>
    </div>
  );
}
