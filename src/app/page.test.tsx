import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { join } from "path";

// src/components/marketing/fonts.ts calls next/font/google at import time,
// which only works inside Next.js's own build (SWC transform) — same
// constraint and same fix already established for src/lib/fonts.ts's Inter
// usage in the invoice/quotation document tests. vi.mock calls are hoisted
// above the imports below by Vitest's transform.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter-mock", className: "font-inter-mock" }),
  Inter_Tight: () => ({ variable: "--font-inter-tight-mock", className: "font-inter-tight-mock" }),
}));

import Home from "./page";
import { Pricing as PricingSection } from "@/components/marketing/Pricing";
import { FinalCta } from "@/components/marketing/FinalCta";
import { SocialProof } from "@/components/marketing/SocialProof";
import { TrustStrip } from "@/components/marketing/Strips";
import { NODES } from "@/components/marketing/Connected";

// This project has no React test renderer (no @testing-library/react, no
// jsdom) — components are called directly as plain functions and the
// returned element tree is walked manually (see src/app/dashboard/
// page.test.tsx for the established convention). Several ported marketing
// components call hooks directly (Hero, Connected, Nav, Faq, WatchModal,
// Dashboard) and can't be invoked this way — for those, either a source
// scan or an exported data constant is used instead, matching the same
// "split hook-bearing UI from testable data" pattern already used for
// src/lib/homeCreateMenu.ts / HomeCreateMenu.tsx.
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

const marketingDir = fileURLToPath(new URL("../components/marketing/", import.meta.url));

function readAllMarketingSource(): string {
  return readdirSync(marketingDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => readFileSync(join(marketingDir, f), "utf-8"))
    .join("\n");
}

describe("Marketing homepage — hero", () => {
  it("renders exactly one h1 across the whole page, with the hero headline", () => {
    const source = readFileSync(join(marketingDir, "Hero.tsx"), "utf-8");
    const allSource = readAllMarketingSource();
    const h1Count = (allSource.match(/<h1[\s>]/g) ?? []).length;
    expect(h1Count).toBe(1);
    expect(source).toContain("Your CA firm.");
    expect(source).toContain("one system.");
  });
});

describe("Marketing homepage — pricing", () => {
  it("renders all five real plan tiers with prices verified against prisma/seed.ts", () => {
    const tree = PricingSection();
    const text = textOf(tree);
    expect(text).toContain("Solo");
    expect(text).toContain("₹1,000");
    expect(text).toContain("Starter");
    expect(text).toContain("₹7,500");
    expect(text).toContain("Growth");
    expect(text).toContain("₹12,500");
    expect(text).toContain("Scale");
    expect(text).toContain("₹17,000");
    expect(text).toContain("Enterprise");
    expect(text).toContain("₹27,000");
    // No fabricated tiers/limits from the Lovable source.
    expect(text).not.toContain("Professional");
    expect(text).not.toContain("Custom");
    expect(text).not.toContain("clients,");
  });

  it("marks exactly one tier (Growth) as Most popular", () => {
    const tree = PricingSection();
    const text = textOf(tree);
    const occurrences = text.split("Most popular").length - 1;
    expect(occurrences).toBe(1);
  });

  it("every pricing CTA links to /signup", () => {
    const tree = PricingSection();
    const hrefs = findAllByProp(tree, "href").map((el) => el.props.href);
    expect(hrefs.filter((h) => h === "/signup")).toHaveLength(5);
  });
});

describe("Marketing homepage — primary CTAs", () => {
  it("the final CTA band links to /signup", () => {
    const tree = FinalCta({ onWatch: () => {} });
    const hrefs = findAllByProp(tree, "href").map((el) => el.props.href);
    expect(hrefs).toContain("/signup");
  });

  it("every real CTA across the marketing components points at /login, /signup, or a real depth page, never a fabricated route", () => {
    const source = readAllMarketingSource();
    // Broadened to also catch multi-segment paths (e.g. /product/clients)
    // now that the depth pages (/product/*, /security, /pricing) are real.
    const hrefMatches = source.match(/href="\/[a-z0-9/-]*"/g) ?? [];
    const internalRoutes = hrefMatches.map((m) => m.slice(6, -1)).filter((h) => h !== "");
    const ALLOWED_ROUTES = [
      "/login",
      "/signup",
      "/pricing",
      "/security",
      "/product",
      "/product/clients",
      "/product/tasks",
      "/product/documents",
      "/product/billing",
      "/product/reconciliation",
    ];
    internalRoutes.forEach((route) => {
      expect(ALLOWED_ROUTES).toContain(route);
    });
  });
});

describe("Marketing homepage — testimonials and firm logos", () => {
  it("both real testimonials render with correct attribution", () => {
    const tree = SocialProof();
    const text = textOf(tree);
    expect(text).toContain("CA Ramesh Babu");
    expect(text).toContain("V Srinivasulu and Co");
    expect(text).toContain("CA K. Bhanu Teja");
    expect(text).toContain("K Bhanu Teja and Associates");
  });

  it("both early-client firm names render in the trust strip", () => {
    const tree = TrustStrip();
    const text = textOf(tree);
    expect(text).toContain("V Srinivasulu and Co");
    expect(text).toContain("K Bhanu Teja and Associates");
  });
});

describe("Marketing homepage — everything connected chain", () => {
  it("renders all nine steps in the correct order", () => {
    expect(NODES.map((n) => n[1])).toEqual([
      "Client",
      "Recurring task",
      "Document request",
      "Document received",
      "Invoice",
      "Reconciliation",
      "Exception",
      "Review task",
      "Resolved",
    ]);
  });
});

describe("Marketing homepage — security claim accuracy", () => {
  it("does not claim client-record view/access is logged (unverified) — uses the accurate wording instead", () => {
    const source = readFileSync(join(marketingDir, "Security.tsx"), "utf-8");
    expect(source).not.toContain("Access to client records is logged");
    expect(source).toContain("Important client and workflow activity is recorded");
  });
});

describe("Marketing homepage — no server-side data fetching", () => {
  it("page.tsx imports neither the Prisma client nor getSession", () => {
    const filePath = fileURLToPath(new URL("./page.tsx", import.meta.url));
    const source = readFileSync(filePath, "utf-8");
    expect(source).not.toContain('from "@/lib/prisma"');
    expect(source).not.toContain('from "@/lib/auth"');
    expect(source).not.toContain("getSession(");
    expect(source).not.toContain("prisma.");
  });

  it("no marketing component imports Prisma or getSession either", () => {
    const source = readAllMarketingSource();
    expect(source).not.toContain('from "@/lib/prisma"');
    expect(source).not.toContain('from "@/lib/auth"');
  });

  it("Home takes no arguments and returns a plain element tree synchronously (not async)", () => {
    expect(Home.length).toBe(0);
    const result = Home();
    expect(result).not.toBeInstanceOf(Promise);
  });
});
