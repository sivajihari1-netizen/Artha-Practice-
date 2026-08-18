// Platform-owner access to /admin. There is no separate "platform admin"
// account type — you log in as a normal firm user, and this checks your
// session email against an allowlist. Update SUPER_ADMIN_EMAILS (comma-
// separated) in Railway to add/remove who can see /admin; no code change
// or redeploy needed for that.
export function isSuperAdminEmail(email: string): boolean {
  const list = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
