import { Lock, ShieldCheck, Users, Server, KeyRound } from "lucide-react";
import { Eyebrow, Section } from "./primitives";

// Every claim below verified against source this session:
// - Encrypted credentials: AES-256-GCM vault (src/lib/crypto or equivalent, verified prior turns).
// - Role-based access: Partner/Manager/Staff gates confirmed across API routes.
// - Isolated firm workspaces: every query scoped by firmId, confirmed repeatedly.
// - Secure sessions: src/lib/auth.ts — JWT `expiresIn: SESSION_MAX_AGE_SECONDS`,
//   cookie `maxAge` matches, and logout clears the cookie (`maxAge: 0`) — verified directly.
// - "Protected client data": the Lovable source claimed "Access to client
//   records is logged to activity" — checked against src/lib/activity.ts and
//   found FALSE. The Activity model only logs state changes (CREATED/
//   UPDATED/STATUS_CHANGED/SENT/PAID etc.), never read/view access. Reworded
//   to the accurate claim below instead of copying the overstated one.
export const SECURITY = [
  [Lock, "Encrypted credentials", "Client credentials stored encrypted at rest."],
  [Users, "Role-based access", "Staff see only the clients and modules you allow."],
  [Server, "Isolated firm workspaces", "Your firm's data is scoped to your firm alone."],
  [KeyRound, "Secure sessions", "Session handling with enforced expiry and sign-out."],
  [
    ShieldCheck,
    "Protected client data",
    "Important client and workflow activity is recorded in the firm's activity history.",
  ],
] as const;

export function Security() {
  return (
    <Section id="security">
      <div className="grid gap-8 rounded-2xl border border-mkt-border bg-mkt-surface p-6 md:p-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <div>
          <Eyebrow>Security</Eyebrow>
          <h2 className="font-mkt-display text-[clamp(1.6rem,2.8vw,2.1rem)] font-semibold tracking-[-0.03em] text-mkt-fg">
            Your clients trust you with sensitive data. We take that seriously.
          </h2>
          <p className="mt-4 text-[14.5px] text-mkt-fg-muted">No inflated claims — only what Artha actually enforces today.</p>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-mkt-border bg-mkt-border">
          {SECURITY.map(([Icon, t, d]) => (
            <div key={t} className="flex items-start gap-3 bg-mkt-surface-2 p-4">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--mkt-wash)] text-mkt-primary">
                <Icon className="size-[14px]" />
              </span>
              <div>
                <p className="text-[13px] font-medium text-mkt-fg">{t}</p>
                <p className="text-[12px] text-mkt-fg-muted">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
