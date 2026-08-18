import { NextResponse } from "next/server";
import { getSession, SessionPayload } from "@/lib/auth";

/** Shared guard for Route Handlers: returns the session or a 401 response. */
export function requireSession(): { session: SessionPayload } | { error: NextResponse } {
  const session = getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { session };
}
