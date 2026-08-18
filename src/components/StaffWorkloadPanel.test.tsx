import { describe, expect, it } from "vitest";
import StaffWorkloadPanel from "./StaffWorkloadPanel";

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) {
    return textOf((node as any).props.children);
  }
  return "";
}

describe("StaffWorkloadPanel — P1 batch: workload visibility", () => {
  it("renders correct open/overdue/due-soon counts per staff member", () => {
    const text = textOf(
      StaffWorkloadPanel({
        rows: [{ userId: "u1", name: "Priya Sharma", open: 7, overdue: 2, dueSoon: 3 }],
      })
    );
    expect(text).toContain("Priya Sharma");
    expect(text).toContain("7");
    expect(text).toContain("2");
    expect(text).toContain("3");
  });

  it("labels a heavy load (>10 open) distinctly from a light one", () => {
    const heavy = textOf(StaffWorkloadPanel({ rows: [{ userId: "u1", name: "Overloaded", open: 15, overdue: 0, dueSoon: 0 }] }));
    const light = textOf(StaffWorkloadPanel({ rows: [{ userId: "u2", name: "Fresh", open: 2, overdue: 0, dueSoon: 0 }] }));
    expect(heavy).toContain("Heavy");
    expect(light).toContain("Light");
  });

  it("renders nothing (null) when there are no rows — e.g. a firm with no active staff to show", () => {
    const el = StaffWorkloadPanel({ rows: [] });
    expect(el).toBeNull();
  });

  it("sorts staff by open-task count, most loaded first — answers 'who is overloaded' at a glance", () => {
    const text = textOf(
      StaffWorkloadPanel({
        rows: [
          { userId: "u1", name: "Low Load", open: 2, overdue: 0, dueSoon: 0 },
          { userId: "u2", name: "High Load", open: 12, overdue: 0, dueSoon: 0 },
        ],
      })
    );
    expect(text.indexOf("High Load")).toBeLessThan(text.indexOf("Low Load"));
  });
});
