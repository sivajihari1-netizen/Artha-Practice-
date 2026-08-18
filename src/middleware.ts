import { NextRequest, NextResponse } from "next/server";

// Next.js middleware runs on the Edge runtime, where the `jsonwebtoken`
// package (Node crypto) isn't available. So this only does a cheap presence
// check on the relevant session cookie and redirects unauthenticated
// visitors away from /dashboard or /portal. The JWT signature is fully
// verified server-side via getSession()/getPortalSession() in the respective
// layouts and every Route Handler — treat that as the real authorization
// boundary, not this file.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const base = process.env.APP_URL || req.nextUrl.origin;

  // src/app/page.tsx (the public marketing homepage) is fully static — no
  // session lookup in the page itself. A logged-in visitor to "/" previously
  // got redirected to /dashboard by src/app/route.ts's getSession() check;
  // preserved here as the same cheap cookie-presence check used below, not a
  // full JWT verify. A stale/expired cookie just lands them on /dashboard,
  // which independently redirects to /login via the block right after this.
  if (pathname === "/") {
    if (req.cookies.get("artha_session")?.value) {
      return NextResponse.redirect(new URL("/dashboard", base));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!req.cookies.get("artha_session")?.value) {
      // Use the configured canonical origin rather than the raw request URL —
      // behind a proxy, an unrecognized/unregistered Host header can cause the
      // request's own resolved origin to fall back to the server's internal
      // bind address instead of the public domain.
      return NextResponse.redirect(new URL("/login", base));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal") && pathname !== "/portal/login") {
    if (!req.cookies.get("artha_portal_session")?.value) {
      return NextResponse.redirect(new URL("/portal/login", base));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    // Same cheap presence check as /dashboard — the real authorization (is
    // this specific email a super admin?) happens server-side in the page.
    if (!req.cookies.get("artha_session")?.value) {
      return NextResponse.redirect(new URL("/login", base));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/portal/:path*", "/admin/:path*"],
};
