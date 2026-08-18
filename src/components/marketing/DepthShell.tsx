"use client";

import { useRouter } from "next/navigation";
import { Nav } from "./Nav";
import { Footer } from "./Footer";

// Shared chrome for the marketing "depth" pages (/product/*, /security,
// /pricing) added for SEO/discoverability. Reuses the exact same Nav and
// Footer as the homepage — no separate nav/footer design was introduced.
// "Watch Artha in Action" has no modal to open outside the homepage, so it
// sends the visitor back to the homepage's Hero instead of duplicating the
// WatchModal on every depth page.
export function DepthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <>
      <Nav onWatch={() => router.push("/#top")} />
      <main id="content" className="min-h-screen bg-mkt-bg pt-24 text-mkt-fg md:pt-28">
        {children}
      </main>
      <Footer />
    </>
  );
}
