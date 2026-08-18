// One-off: signs up a throwaway demo firm on the live app, seeds realistic
// data, records a short video of real task-status changes on the Kanban
// board, converts it to a compressed web-ready mp4 via Playwright's bundled
// ffmpeg, then deletes all the demo data. Not part of the app itself.
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const BASE = "https://arthapractice.in";
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("Set DATABASE_URL"); process.exit(1); }

const FFMPEG = "node_modules/ffmpeg-static/ffmpeg.exe";
if (!fs.existsSync(FFMPEG)) { console.error("ffmpeg not found at", FFMPEG); process.exit(1); }

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
      email: `demo-video-${Date.now()}@arthapractice.in`,
      password: "demo-video-pass-1",
    }),
  });
  if (!signupRes.ok) throw new Error("signup failed: " + (await signupRes.text()));
  const cookieValue = signupRes.headers.get("set-cookie").split(";")[0].split("=").slice(1).join("=");
  const headers = { "Content-Type": "application/json", Cookie: `artha_session=${cookieValue}` };

  async function post(p, body) {
    const res = await fetch(`${BASE}${p}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${p} failed: ${await res.text()}`);
    return res.json();
  }
  async function patch(p, body) {
    const res = await fetch(`${BASE}${p}`, { method: "PATCH", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${p} failed: ${await res.text()}`);
    return res.json();
  }

  console.log("Seeding clients + tasks...");
  const clientDefs = [
    { name: "Meridian Textiles Pvt Ltd", type: "COMPANY" },
    { name: "Kaveri Traders", type: "PROPRIETORSHIP" },
    { name: "Sundar & Sons LLP", type: "LLP" },
  ];
  const clients = [];
  for (const c of clientDefs) {
    const { client } = await post("/api/clients", c);
    clients.push(client);
  }

  const taskDefs = [
    { title: "GSTR-3B — June 2026", returnType: "GST", dueDate: daysFromNow(3), clientId: clients[0].id, status: "TODO" },
    { title: "GSTR-1 — June 2026", returnType: "GST", dueDate: daysFromNow(6), clientId: clients[1].id, status: "TODO" },
    { title: "TDS Return Q1 FY26-27", returnType: "TDS", dueDate: daysFromNow(10), clientId: clients[2].id, status: "TODO" },
    { title: "ITR Filing — AY 2026-27", returnType: "ITR", dueDate: daysFromNow(20), clientId: clients[0].id, status: "IN_PROGRESS" },
    { title: "ROC Annual Filing — AOC-4", returnType: "ROC", dueDate: daysFromNow(15), clientId: clients[1].id, status: "REVIEW" },
    { title: "Statutory Audit — FY 2025-26", returnType: "AUDIT", dueDate: daysFromNow(30), clientId: clients[0].id, status: "DONE" },
  ];
  const createdTasks = [];
  for (const t of taskDefs) {
    const { status, ...body } = t;
    const { task } = await post("/api/tasks", body);
    if (status !== "TODO") await patch(`/api/tasks/${task.id}`, { status });
    createdTasks.push(task);
  }

  console.log("Recording video...");
  const videoDir = "_video_tmp";
  fs.mkdirSync(videoDir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 620 },
    recordVideo: { dir: videoDir, size: { width: 1280, height: 620 } },
  });
  await context.addCookies([
    { name: "artha_session", value: cookieValue, domain: "arthapractice.in", path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard/tasks`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=To Do");
  await page.waitForTimeout(600);

  // The board does router.refresh() after each change, which destroys and
  // recreates the <select> DOM nodes — always re-query fresh by current
  // value rather than reusing handles or relying on stale indices.
  async function selectFirstWithValue(value) {
    const selects = await page.$$("select");
    for (const s of selects) {
      if ((await s.inputValue()) === value) return s;
    }
    throw new Error("No select found with value " + value);
  }

  // Move a To Do task -> In Progress
  await (await selectFirstWithValue("TODO")).selectOption("IN_PROGRESS");
  await page.waitForTimeout(1400);

  // Move another To Do task -> In Progress
  await (await selectFirstWithValue("TODO")).selectOption("IN_PROGRESS");
  await page.waitForTimeout(1400);

  // Move an In Progress task -> Review
  await (await selectFirstWithValue("IN_PROGRESS")).selectOption("REVIEW");
  await page.waitForTimeout(1600);

  await context.close();
  const videoPath = await page.video().path();
  console.log("Raw video saved to", videoPath);
  await browser.close();

  console.log("Converting to compressed mp4...");
  fs.mkdirSync("public/screenshots", { recursive: true });
  const outPath = "public/screenshots/dashboard-demo.mp4";
  execFileSync(FFMPEG, [
    "-y", "-i", videoPath,
    "-vf", "crop=1280:620:0:0",
    "-c:v", "libx264", "-crf", "26", "-preset", "slow",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-an",
    outPath,
  ], { stdio: "inherit" });

  const stat = fs.statSync(outPath);
  console.log("Final mp4 size:", (stat.size / 1024).toFixed(1), "KB");

  fs.rmSync(videoDir, { recursive: true, force: true });

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
  }
  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
