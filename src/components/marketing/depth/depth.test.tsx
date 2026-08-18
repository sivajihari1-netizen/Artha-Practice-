import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { MODULES } from "./moduleData";
import { PLANS } from "../Pricing";

// DepthShell/ProductBodies/PricingBody all call useRouter/useState directly
// (not just import from a "use client" file) — same "Invalid hook call"
// constraint as Hero/Nav/Faq/Dashboard elsewhere in this project (see
// src/app/page.test.tsx's header comment), so these are verified by source
// scan / data-shape / real-file-exists checks instead of direct invocation.

const appDir = join(process.cwd(), "src", "app");

describe("Depth pages — /product modules", () => {
  it("MODULES lists exactly the 5 real product modules with matching real page files", () => {
    expect(MODULES.map((m) => m.slug)).toEqual(["clients", "tasks", "documents", "billing", "reconciliation"]);
    for (const m of MODULES) {
      expect(existsSync(join(appDir, "product", m.slug, "page.tsx"))).toBe(true);
    }
  });

  it("the /product hub page exists", () => {
    expect(existsSync(join(appDir, "product", "page.tsx"))).toBe(true);
  });
});

describe("Depth pages — /security and /pricing", () => {
  it("both real pages exist on disk", () => {
    expect(existsSync(join(appDir, "security", "page.tsx"))).toBe(true);
    expect(existsSync(join(appDir, "pricing", "page.tsx"))).toBe(true);
  });
});

describe("Depth pages — pricing seat calculator data", () => {
  it("PLANS.seats matches prisma/seed.ts maxUsers per tier exactly", () => {
    const bySeats = Object.fromEntries(PLANS.map((p) => [p.name, p.seats]));
    expect(bySeats).toEqual({ Solo: 1, Starter: 10, Growth: 20, Scale: 40, Enterprise: 60 });
  });

  it("seats are strictly increasing across tiers, so the calculator's `seats <= p.seats` lookup always finds the cheapest fitting plan", () => {
    const seats = PLANS.map((p) => p.seats);
    for (let i = 1; i < seats.length; i++) {
      expect(seats[i]).toBeGreaterThan(seats[i - 1]!);
    }
  });
});
