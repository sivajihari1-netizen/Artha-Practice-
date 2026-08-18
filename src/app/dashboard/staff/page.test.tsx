import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({ getSession: () => mockGetSession() }));

const mockUserFindMany = vi.fn();
const mockAttendanceFindFirst = vi.fn();
const mockLeaveFindMany = vi.fn();
const mockTaskFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    attendanceLog: { findFirst: (...a: unknown[]) => mockAttendanceFindFirst(...a) },
    leaveRequest: { findMany: (...a: unknown[]) => mockLeaveFindMany(...a) },
    task: { findMany: (...a: unknown[]) => mockTaskFindMany(...a) },
  },
}));

const mockGetStaffLoadForFirm = vi.fn();
vi.mock("@/lib/recurringTasks", () => ({
  getStaffLoadForFirm: (...a: unknown[]) => mockGetStaffLoadForFirm(...a),
}));

import StaffPage from "./page";
import StaffRoleStatusControls from "@/components/StaffRoleStatusControls";

function findAllByType(node: unknown, type: unknown, out: any[] = []): any[] {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) findAllByType(n, type, out);
    return out;
  }
  const el = node as any;
  if (el.type === type) out.push(el);
  if (el.props?.children !== undefined) findAllByType(el.props.children, type, out);
  return out;
}

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in (node as any)) return textOf((node as any).props.children);
  return "";
}

const STAFF_ROWS = [
  { id: "user_partner", name: "Priya Partner", email: "priya@firm.test", role: "PARTNER" as const, active: true },
  { id: "user_staff1", name: "Sam Staff", email: "sam@firm.test", role: "STAFF" as const, active: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUserFindMany.mockResolvedValue(STAFF_ROWS);
  mockAttendanceFindFirst.mockResolvedValue(null);
  mockLeaveFindMany.mockResolvedValue([]);
  mockGetStaffLoadForFirm.mockResolvedValue([]);
  mockTaskFindMany.mockResolvedValue([]);
});

describe("9. Staff page — renders correctly, and Batch A's controls are gated by role and self-protection", () => {
  it("a PARTNER sees role/status controls for OTHER staff rows", async () => {
    mockGetSession.mockReturnValue({ userId: "user_partner", firmId: "firm_1", role: "PARTNER", email: "priya@firm.test" });
    const tree = await StaffPage();
    const controls = findAllByType(tree, StaffRoleStatusControls);
    expect(controls).toHaveLength(1);
    expect(controls[0].props.staffId).toBe("user_staff1");
  });

  it("a PARTNER does NOT get controls on their own row (self-protection, not a backend rule)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_partner", firmId: "firm_1", role: "PARTNER", email: "priya@firm.test" });
    const tree = await StaffPage();
    const controls = findAllByType(tree, StaffRoleStatusControls);
    expect(controls.every((c) => c.props.staffId !== "user_partner")).toBe(true);
    expect(textOf(tree)).toContain("(you)");
  });

  it("4/5. a MANAGER viewing the page never receives any role/status control", async () => {
    mockGetSession.mockReturnValue({ userId: "user_manager", firmId: "firm_1", role: "MANAGER", email: "m@firm.test" });
    mockUserFindMany.mockResolvedValue([...STAFF_ROWS, { id: "user_manager", name: "Max Manager", email: "m@firm.test", role: "MANAGER", active: true }]);
    const tree = await StaffPage();
    expect(findAllByType(tree, StaffRoleStatusControls)).toHaveLength(0);
  });

  it("4/5. a STAFF viewing the page never receives any role/status control", async () => {
    mockGetSession.mockReturnValue({ userId: "user_staff1", firmId: "firm_1", role: "STAFF", email: "sam@firm.test" });
    const tree = await StaffPage();
    expect(findAllByType(tree, StaffRoleStatusControls)).toHaveLength(0);
  });

  it("still renders the staff count and every staff member's name", async () => {
    mockGetSession.mockReturnValue({ userId: "user_partner", firmId: "firm_1", role: "PARTNER", email: "priya@firm.test" });
    const tree = await StaffPage();
    const text = textOf(tree);
    expect(text).toContain("2 team members");
    expect(text).toContain("Priya Partner");
    expect(text).toContain("Sam Staff");
  });

  it("plain-text role/status still render for a STAFF viewer (read-only, unchanged from before Batch A)", async () => {
    mockGetSession.mockReturnValue({ userId: "user_staff1", firmId: "firm_1", role: "STAFF", email: "sam@firm.test" });
    const tree = await StaffPage();
    const text = textOf(tree);
    expect(text).toContain("PARTNER");
    expect(text).toContain("Active");
  });
});
