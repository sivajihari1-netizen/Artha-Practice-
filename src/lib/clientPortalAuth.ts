import crypto from "crypto";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
const PORTAL_SESSION_COOKIE = "artha_portal_session";
const PORTAL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

type PortalSessionPayload = {
  scope: "client-portal";
  email: string;
};

/** Signs a portal session JWT. The `scope` claim keeps this from ever being confused with a staff SessionPayload. */
export function signPortalSession(email: string): string {
  const payload: PortalSessionPayload = { scope: "client-portal", email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: PORTAL_SESSION_MAX_AGE_SECONDS });
}

export function verifyPortalSession(token: string): PortalSessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as PortalSessionPayload;
    return decoded.scope === "client-portal" ? decoded : null;
  } catch {
    return null;
  }
}

export function setPortalSessionCookie(token: string) {
  cookies().set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE_SECONDS,
  });
}

export function clearPortalSessionCookie() {
  cookies().set(PORTAL_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Read + verify the current client-portal session (Server Components / Route Handlers). */
export function getPortalSession(): PortalSessionPayload | null {
  const token = cookies().get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyPortalSession(token);
}

export function generateMagicLinkToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function magicLinkExpiry(): Date {
  return new Date(Date.now() + MAGIC_LINK_TTL_MS);
}

export { PORTAL_SESSION_COOKIE };
