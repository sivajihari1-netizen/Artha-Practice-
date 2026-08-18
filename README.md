# Artha — CA Practice Management Platform

Full-stack app for the Artha CA practice management product: multi-tenant
(one workspace per firm), staff accounts with roles, client CRM with an
encrypted credentials vault, a Kanban task board with recurring-task
generation, a compliance calendar, a document vault, WhatsApp/email
reminders, and Razorpay billing.

Stack: Next.js 14 (App Router, TypeScript) · Prisma + PostgreSQL · Tailwind CSS.

This was hand-authored directly as source files rather than scaffolded and
built inside the sandbox — the sandbox couldn't reach npm's registry/Prisma's
binary CDN long enough to run a full `npm install`, so **you're the first to
install and run it.** Follow the steps below; if something doesn't compile,
it's most likely a small dependency-version mismatch, not a structural
problem — the module boundaries, Prisma schema, and route contracts are all
consistent with each other.

## 1. Install

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in at minimum:
- `DATABASE_URL` — a Postgres connection string. Easiest options: a free
  instance on [Neon](https://neon.tech) or [Supabase](https://supabase.com),
  or `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16` locally.
- `JWT_SECRET` — any long random string.
- `CREDENTIALS_ENC_KEY` — generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

Everything else (WhatsApp, email, S3 storage, Razorpay, the AI agents) works
in **stub mode** with no configuration — the app logs what it would have
done instead of failing, so you can build/demo the full flow before signing
up for those services. Fill them in later, one at a time, when you're ready
to go live with each. Without `ANTHROPIC_API_KEY`, the agents in
`src/lib/agents.ts` fall back to deterministic logic instead of a real
Claude call — same idea as the WhatsApp/email stub.

## 3. Set up the database

```bash
npx prisma migrate dev --name init
npm run seed   # loads the Solo/Starter/Growth/Scale/Enterprise plans
```

## 4. Run it

```bash
npm run dev
```

Visit http://localhost:3000 → you'll land on `/signup`. The first account
you create becomes the firm's PARTNER.

## Module map

| Area | Where |
|---|---|
| Auth (signup/login/session) | `src/lib/auth.ts`, `src/app/api/auth/*`, `src/app/(login|signup)` |
| Client CRM + credentials vault + leads | `src/app/dashboard/clients`, `src/app/dashboard/leads`, `src/lib/crypto.ts` |
| Tasks (Kanban + recurring templates) | `src/app/dashboard/tasks`, `src/lib/recurringTasks.ts` |
| Compliance calendar + DSC expiry | `src/app/dashboard/calendar` |
| Notifications (WhatsApp/email) | `src/lib/whatsapp.ts`, `src/lib/email.ts`, `src/app/dashboard/notifications` |
| Staff, attendance, leave | `src/app/dashboard/staff` |
| Document vault | `src/lib/storage.ts`, `src/app/dashboard/documents` |
| Billing (Razorpay) | `src/lib/razorpay.ts`, `src/app/dashboard/billing` |
| AI agents (document chase, reconciliation) + review queue | `src/lib/agents.ts`, `src/lib/agentTools.ts`, `src/lib/claudeAgent.ts`, `src/app/dashboard/agent-review` |
| Reconciliation Exception Engine (GSTR-2B/1 + bank vs books, deterministic matching, risk scoring, task escalation) | `src/lib/reconciliation/`, `src/app/api/clients/[id]/reconciliation-runs`, `src/app/api/reconciliation-runs`, `src/app/api/reconciliation-matches`. No UI yet — API + `npm test` only; see "Known gaps" below. |

## Wiring up the two cron jobs

Two things need to run daily via an external scheduler — this app has no
built-in cron, so pick one:

- **Vercel Cron** (if you deploy there) — add to `vercel.json`:
  ```json
  {
    "crons": [
      { "path": "/api/cron/generate-recurring-tasks", "schedule": "0 3 * * *" },
      { "path": "/api/cron/send-reminders", "schedule": "0 4 * * *" }
    ]
  }
  ```
  Vercel Cron calls these as GET by default — either switch the route
  handlers to GET or use a Vercel Cron variant that supports POST + custom
  headers so `x-cron-secret` gets sent.
- **Any VPS** — a plain crontab entry with `curl`:
  ```
  0 3 * * * curl -X POST https://yourapp.com/api/cron/generate-recurring-tasks -H "x-cron-secret: $CRON_SECRET"
  0 4 * * * curl -X POST https://yourapp.com/api/cron/send-reminders -H "x-cron-secret: $CRON_SECRET"
  ```
- **GitHub Actions** scheduled workflow hitting the same URLs also works.

## Going live with each integration

- **WhatsApp** — sign up for the WhatsApp Business Cloud API (via Meta
  directly, or a BSP like Gupshup/Twilio/Interakt for easier onboarding),
  get pre-approved message templates (required — you can't free-form
  message clients who haven't messaged you first), then fill in
  `WHATSAPP_API_URL` / `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`.
- **Email** — any SMTP provider works (`SMTP_HOST` etc.), or swap
  `src/lib/email.ts` for Resend/SendGrid's SDK if you prefer.
- **Document storage** — any S3-compatible provider: AWS S3, Cloudflare R2
  (cheapest, no egress fees), Backblaze B2. Fill in `S3_*` vars. Without
  them, files are written to local disk — fine for local dev, **will not
  work if you deploy to Vercel or another serverless host** (ephemeral
  filesystem), so configure this before going to production.
- **Razorpay** — get API keys from the Razorpay dashboard, add
  `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, then register the webhook URL
  `https://yourapp.com/api/billing/webhook` in the dashboard and copy the
  webhook secret into `RAZORPAY_WEBHOOK_SECRET`.

## Known gaps / next steps

This covers the full feature set from the spec end-to-end but is a first
pass, not a security-audited production build. Before charging real
customers or handling real client PAN/GST data, get a second set of eyes on
at minimum:

- Rate limiting on `/api/auth/*` (currently none — add e.g. `@upstash/ratelimit`).
- An audit log for credential-vault reveals (the route has a comment marking
  where to add this).
- Email verification on signup (currently any email works, no confirmation step).
- Automated tests — mostly none yet; the app was hand-written file-by-file
  and reviewed manually rather than compiled/tested in this environment.
  Exception: `src/lib/reconciliation/match.test.ts` (`npm test`, via
  Vitest) covers the reconciliation matching engine.
- Drag-and-drop on the Kanban board (currently a "move to" dropdown per
  card — functional, not fancy).
- The Reconciliation Exception Engine (`src/lib/reconciliation/`) has no
  review UI yet — everything works end-to-end through the API
  (`POST /api/clients/:id/reconciliation-runs` to upload+run,
  `GET /api/reconciliation-runs/:id/exceptions` to list, `PATCH
  /api/reconciliation-matches/:id` to resolve/ignore) but there's no page to
  click through. PDF bank-statement OCR is also not built (by design — the
  build spec put it last, behind a feature flag).
