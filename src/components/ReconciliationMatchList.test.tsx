import { describe, expect, it } from "vitest";
import ReconciliationMatchList, { type ReconciliationMatchListItem } from "./ReconciliationMatchList";

function findAllByProp(node: unknown, propName: string, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByProp(n, propName, out);
    return out;
  }
  const el = node as any;
  if (el.props?.[propName] !== undefined) out.push(el);
  if (el.props?.children !== undefined) findAllByProp(el.props.children, propName, out);
  return out;
}

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

function match(overrides: Partial<ReconciliationMatchListItem> = {}): ReconciliationMatchListItem {
  return {
    id: "match_1",
    riskScore: 75,
    exceptionReason: "AMOUNT_MISMATCH",
    exceptionExplanation: "Amount differs by ₹500",
    reconciliationRun: { type: "GST_2B_VS_PURCHASE", periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-06-30"), client: { id: "client_1", name: "Acme" } },
    task: null,
    ...overrides,
  };
}

describe("ReconciliationMatchList", () => {
  it("shows the caller-supplied empty message when there are no matches", () => {
    const tree = ReconciliationMatchList({ matches: [], emptyMessage: "Nothing here." });
    expect(textOf(tree)).toBe("Nothing here.");
  });

  it("renders risk score, reason label, and explanation for a match", () => {
    const tree = ReconciliationMatchList({ matches: [match()], emptyMessage: "" });
    const text = textOf(tree);
    expect(text).toContain("Risk 75");
    expect(text).toContain("Amount mismatch");
    expect(text).toContain("Amount differs by ₹500");
  });

  it("falls back to 'No explanation recorded.' when exceptionExplanation is null", () => {
    const tree = ReconciliationMatchList({ matches: [match({ exceptionExplanation: null })], emptyMessage: "" });
    expect(textOf(tree)).toContain("No explanation recorded.");
  });

  it("falls back to the raw enum value for an unmapped reason", () => {
    const tree = ReconciliationMatchList({ matches: [match({ exceptionReason: "SOME_FUTURE_REASON" as any })], emptyMessage: "" });
    expect(textOf(tree)).toContain("SOME_FUTURE_REASON");
  });

  it("shows a Task link when a task is present, none when it isn't", () => {
    const withTask = ReconciliationMatchList({ matches: [match({ task: { id: "task_1", title: "Follow up" } })], emptyMessage: "" });
    expect(findAllByProp(withTask, "href").some((l) => l.props.href === "/dashboard/tasks/task_1")).toBe(true);

    const withoutTask = ReconciliationMatchList({ matches: [match({ task: null })], emptyMessage: "" });
    expect(findAllByProp(withoutTask, "href").filter((l) => typeof l.props.href === "string" && l.props.href.startsWith("/dashboard/tasks/"))).toHaveLength(0);
  });

  it("renders one card per match, preserving order", () => {
    const tree = ReconciliationMatchList({
      matches: [match({ id: "m1", exceptionExplanation: "First" }), match({ id: "m2", exceptionExplanation: "Second" })],
      emptyMessage: "",
    });
    const text = textOf(tree);
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
  });
});
