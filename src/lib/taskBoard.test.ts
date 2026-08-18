import { describe, expect, it } from "vitest";
import { getTaskColumnId, priorityRank, formatDocRequestSummary, taskHref } from "./taskBoard";

const TODO = { id: "opt_todo", systemKey: "TODO" };
const IN_PROGRESS = { id: "opt_inprogress", systemKey: "IN_PROGRESS" };
const columns = [TODO, IN_PROGRESS];

describe("getTaskColumnId — regression for the Kanban board's stale-statusOptionId bug", () => {
  it("a task with statusOptionId set uses it directly, even if the legacy status enum disagrees", () => {
    // This is exactly the bug scenario: status was updated to IN_PROGRESS but
    // statusOptionId is still stale, still pointing at TODO. The column must
    // follow statusOptionId (the source of truth once it's set), matching
    // what the board's grouping logic actually keys off of.
    const task = { status: "IN_PROGRESS", statusOption: { id: "opt_todo" } };
    expect(getTaskColumnId(task, columns)).toBe("opt_todo");
  });

  it("a task with no statusOption (legacy-only) falls back to matching status against each column's systemKey", () => {
    const task = { status: "IN_PROGRESS", statusOption: null };
    expect(getTaskColumnId(task, columns)).toBe("opt_inprogress");
  });

  it("after a correct move (statusOptionId AND status updated together), the task resolves to the new column", () => {
    const task = { status: "IN_PROGRESS", statusOption: { id: "opt_inprogress" } };
    expect(getTaskColumnId(task, columns)).toBe("opt_inprogress");
  });

  it("legacy-only task whose status matches no active column returns an empty id (falls out of the board, not into a wrong one)", () => {
    const task = { status: "DONE", statusOption: null };
    expect(getTaskColumnId(task, columns)).toBe("");
  });
});

describe("priorityRank — P1 batch: priority as a secondary Kanban sort signal", () => {
  it("orders URGENT before HIGH before MEDIUM before LOW", () => {
    expect(priorityRank("URGENT")).toBeLessThan(priorityRank("HIGH"));
    expect(priorityRank("HIGH")).toBeLessThan(priorityRank("MEDIUM"));
    expect(priorityRank("MEDIUM")).toBeLessThan(priorityRank("LOW"));
  });

  it("an unset priority (null) sorts after every explicit priority, including LOW", () => {
    expect(priorityRank(null)).toBeGreaterThan(priorityRank("LOW"));
  });

  it("actually sorts a task list into the expected order", () => {
    const tasks = [{ id: "a", priority: null }, { id: "b", priority: "LOW" as const }, { id: "c", priority: "URGENT" as const }, { id: "d", priority: "MEDIUM" as const }];
    const sorted = [...tasks].sort((x, y) => priorityRank(x.priority) - priorityRank(y.priority));
    expect(sorted.map((t) => t.id)).toEqual(["c", "d", "b", "a"]);
  });
});

describe("taskHref — Task 360 Phase 1/2: single source of truth for the task detail URL", () => {
  it("builds the canonical Task 360 path", () => {
    expect(taskHref("task_abc123")).toBe("/dashboard/tasks/task_abc123");
  });
});

describe("formatDocRequestSummary — P1 batch: Document -> Task blocking indicator (informational only)", () => {
  it("returns null when no DocumentRequest is linked (nothing to show)", () => {
    expect(formatDocRequestSummary(null)).toBeNull();
  });

  it("returns null for a linked request with zero items (defensive, shouldn't happen but nothing meaningful to show)", () => {
    expect(formatDocRequestSummary({ total: 0, fulfilled: 0 })).toBeNull();
  });

  it("shows outstanding count and received/total when incomplete", () => {
    const result = formatDocRequestSummary({ total: 5, fulfilled: 2 });
    expect(result).toEqual({ outstanding: 3, label: "2/5 documents received · 3 outstanding" });
  });

  it("shows a clean 'all received' message when fully fulfilled — never implies or changes task status", () => {
    const result = formatDocRequestSummary({ total: 3, fulfilled: 3 });
    expect(result).toEqual({ outstanding: 0, label: "✓ All requested documents received" });
  });
});
