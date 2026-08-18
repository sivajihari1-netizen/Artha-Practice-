import { describe, expect, it } from "vitest";
import ReconciliationSubNav from "./ReconciliationSubNav";

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

describe("ReconciliationSubNav", () => {
  it("links to all three reconciliation surfaces when the caller can manage reconciliation", () => {
    const tree = ReconciliationSubNav({ active: "exceptions", canManageReconciliation: true });
    const hrefs = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(hrefs).toEqual(["/dashboard/reconciliation", "/dashboard/reconciliation/runs", "/dashboard/reconciliation/upload"]);
  });

  it("marks the active tab distinctly from the others", () => {
    const tree = ReconciliationSubNav({ active: "runs", canManageReconciliation: true });
    const links = findAllByProp(tree, "href");
    const runsLink = links.find((l) => l.props.href === "/dashboard/reconciliation/runs");
    const exceptionsLink = links.find((l) => l.props.href === "/dashboard/reconciliation");
    expect(runsLink.props.className).toContain("text-accent");
    expect(exceptionsLink.props.className).not.toContain("text-accent");
  });
});

describe("ReconciliationSubNav — F2 Security Refinement: Upload tab visibility", () => {
  it("PARTNER/MANAGER (canManageReconciliation:true) sees the Upload tab", () => {
    const tree = ReconciliationSubNav({ active: "exceptions", canManageReconciliation: true });
    const hrefs = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(hrefs).toContain("/dashboard/reconciliation/upload");
  });

  it("STAFF (canManageReconciliation:false) does not see the Upload tab at all — not disabled, just absent", () => {
    const tree = ReconciliationSubNav({ active: "exceptions", canManageReconciliation: false });
    const hrefs = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(hrefs).not.toContain("/dashboard/reconciliation/upload");
  });

  it("STAFF still sees Exceptions and Runs — only Upload is removed", () => {
    const tree = ReconciliationSubNav({ active: "runs", canManageReconciliation: false });
    const hrefs = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(hrefs).toEqual(["/dashboard/reconciliation", "/dashboard/reconciliation/runs"]);
  });
});
