// One-off script: signs up a throwaway demo firm on the live app, seeds
// realistic-looking clients/tasks, screenshots the Kanban board with
// Playwright for use as the marketing homepage's hero mockup + OG image,
// then deletes all the demo data it created. Not part of the app itself.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const BASE = "https://arthapractice.in";
const DB_URL =
  "postgresql://postgres:egkRlqtSOfPltSJehNWkrsXbOEkZzywS@sakura.proxy.rlwy.net:25249/railway";

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

async function main() {
  console.log("Signing up demo firm...");
  const signupRes = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firmName: "Sharma & Associates",
      name: "Anita Sharma",
      email: `demo-screenshot-${Date.now()}@arthapractice.in`,
      password: "screenshot-demo-pass-1",
    }),
  });
  const setCookie = signupRes.headers.get("set-cookie");
  const cookieValue = setCookie.split(";")[0].split("=").slice(1).join("=");
  if (!signupRes.ok) throw new Error("signup failed: " + (await signupRes.text()));
  console.log("Signed up, cookie acquired.");

  const headers = {
    "Content-Type": "application/json",
    Cookie: `artha_session=${cookieValue}`,
  };

  async function post(path, body) {
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} failed: ${await res.text()}`);
    return (await res.json());
  }
  async function patch(path, body) {
    const res = await fetch(`${BASE}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path} failed: ${await res.text()}`);
    return (await res.json());
  }

  console.log("Seeding clients...");
  const clientDefs = [
    { name: "Meridian Textiles Pvt Ltd", type: "COMPANY" },
    { name: "Kaveri Traders", type: "PROPRIETORSHIP" },
    { name: "Sundar & Sons LLP", type: "LLP" },
    { name: "Rohan Enterprises", type: "PARTNERSHIP" },
    { name: "Priya Menon", type: "INDIVIDUAL" },
  ];
  const clients = [];
  for (const c of clientDefs) {
    const { client } = await post("/api/clients", c);
    clients.push(client);
  }

  console.log("Seeding tasks...");
  const taskDefs = [
    { title: "GSTR-3B — June 2026", returnType: "GST", dueDate: daysFromNow(3), clientId: clients[0].id, status: "TODO" },
    { title: "GSTR-1 — June 2026", returnType: "GST", dueDate: daysFromNow(-2), clientId: clients[1].id, status: "TODO" },
    { title: "GST Registration — New Client", returnType: "GST", dueDate: daysFromNow(6), clientId: clients[4].id, status: "TODO" },
    { title: "TDS Return Q1 FY26-27", returnType: "TDS", dueDate: daysFromNow(10), clientId: clients[2].id, status: "IN_PROGRESS" },
    { title: "ITR Filing — AY 2026-27", returnType: "ITR", dueDate: daysFromNow(20), clientId: clients[3].id, status: "IN_PROGRESS" },
    { title: "ROC Annual Filing — AOC-4", returnType: "ROC", dueDate: daysFromNow(15), clientId: clients[0].id, status: "REVIEW" },
    { title: "ITR Filing — Individual", returnType: "ITR", dueDate: daysFromNow(12), clientId: clients[4].id, status: "REVIEW" },
    { title: "Statutory Audit — FY 2025-26", returnType: "AUDIT", dueDate: daysFromNow(30), clientId: clients[0].id, status: "DONE" },
    { title: "TDS Return Q4 FY25-26", returnType: "TDS", dueDate: daysFromNow(-10), clientId: clients[2].id, status: "DONE" },
  ];
  for (const t of taskDefs) {
    const { status, ...body } = t;
    const { task } = await post("/api/tasks", body);
    if (status !== "TODO") await patch(`/api/tasks/${task.id}`, { status });
  }

  console.log("Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 620 } });
  await context.addCookies([
    { name: "artha_session", value: cookieValue, domain: "arthapractice.in", path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard/tasks`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=To Do");
  await page.waitForTimeout(400);

  fs.mkdirSync("public/screenshots", { recursive: true });
  await page.screenshot({ path: "public/screenshots/dashboard.png" });
  console.log("Saved hero screenshot.");

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: "public/screenshots/dashboard-og.png" });
  console.log("Saved OG screenshot.");

  await browser.close();

  console.log("Cleaning up demo data...");
  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const user = await prisma.user.findFirst({ where: { name: "Anita Sharma" } });
  if (user) {
    const fId = user.firmId;
    await prisma.task.deleteMany({ where: { firmId: fId } });
    await prisma.contactPerson.deleteMany({ where: { client: { firmId: fId } } });
    await prisma.credential.deleteMany({ where: { client: { firmId: fId } } });
    await prisma.client.deleteMany({ where: { firmId: fId } });
    await prisma.subscription.deleteMany({ where: { firmId: fId } });
    await prisma.user.deleteMany({ where: { firmId: fId } });
    await prisma.firm.deleteMany({ where: { id: fId } });
    console.log("Cleaned up demo firm", fId);
  } else {
    console.log("Could not find demo user to clean up — check manually.");
  }
  await prisma.$disconnect();

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
