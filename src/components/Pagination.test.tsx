import { describe, expect, it } from "vitest";
import Pagination from "./Pagination";

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

describe("Pagination", () => {
  it("renders nothing at all when total is 0", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: {}, page: 1, totalPages: 1, total: 0 });
    expect(tree).toBeNull();
  });

  it("shows page/total-results text", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: {}, page: 2, totalPages: 4, total: 173 });
    expect(textOf(tree)).toContain("Page 2 of 4");
    expect(textOf(tree)).toContain("173 results");
  });

  it("singularizes the result count for exactly 1", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: {}, page: 1, totalPages: 1, total: 1 });
    expect(textOf(tree)).toContain("1 result");
    expect(textOf(tree)).not.toContain("1 results");
  });

  it("Previous is not a link on page 1 (no page=0 escape hatch)", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: {}, page: 1, totalPages: 3, total: 60 });
    const links = findAllByProp(tree, "href");
    expect(links.some((l) => l.props.href.includes("page=0"))).toBe(false);
  });

  it("Next is not a link on the last page", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: {}, page: 3, totalPages: 3, total: 60 });
    const links = findAllByProp(tree, "href");
    expect(links).toHaveLength(1); // only Previous
  });

  it("both Previous and Next are links on a middle page, preserving other filters", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: { clientId: "c1" }, page: 2, totalPages: 3, total: 90 });
    const links = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(links).toEqual(["/dashboard/reconciliation?clientId=c1", "/dashboard/reconciliation?clientId=c1&page=3"]);
  });

  it("drops undefined/empty searchParams entries when building hrefs", () => {
    const tree = Pagination({ pathname: "/dashboard/reconciliation", searchParams: { clientId: undefined, type: "" }, page: 1, totalPages: 2, total: 10 });
    const links = findAllByProp(tree, "href").map((l) => l.props.href);
    expect(links).toEqual(["/dashboard/reconciliation?page=2"]);
  });
});
