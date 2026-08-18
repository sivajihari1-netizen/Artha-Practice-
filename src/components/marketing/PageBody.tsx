"use client";

import { Suspense, lazy, useState } from "react";
import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { TrustStrip, CapabilityStrip } from "./Strips";
import { Connected } from "./Connected";
import { Statement } from "./Statement";
import { ProductExplorer } from "./ProductExplorer";
import { BeforeAfter } from "./BeforeAfter";
import { SocialProof } from "./SocialProof";
import { Security } from "./Security";
import { Pricing } from "./Pricing";
import { Faq } from "./Faq";
import { FinalCta } from "./FinalCta";
import { Footer } from "./Footer";
import { ScrollProgress } from "./primitives";

// Off the critical path: the modal's JS only loads when the user asks to
// watch — same as the Lovable source.
const WatchModal = lazy(() => import("./WatchModal").then((m) => ({ default: m.WatchModal })));

// LCP/hydration: these three sections are the heaviest below-the-fold client
// bundles (ROI slider math, an interactive command-palette demo, a comparison
// table) and none of them are visible
// on first paint. Splitting them into separate chunks via next/dynamic keeps
// them out of the JS the browser must parse/hydrate before the Hero (the
// actual LCP element) can paint, without dropping SSR — `ssr` is left at its
// default `true`, so the full HTML (and its text content) still renders
// server-side exactly as before; only the JS download is deferred/split.

// This is the Client Component boundary — `useState` for the modal forces
// it, and Next.js disallows `export const metadata` in a "use client" file,
// which is why this is split out from src/app/page.tsx (a plain Server
// Component) rather than putting "use client" on the page itself.
//
// Structure and section order match the actual Lovable source (Artha
// Practice Hub (2)) Index() exactly: skip-link -> ScrollProgress -> Nav ->
// <main id="content"> Hero -> TrustStrip -> CapabilityStrip -> Connected ->
// Statement -> ProductExplorer -> BeforeAfter -> SocialProof -> Security ->
// Pricing -> Faq -> FinalCta -> Footer -> WatchModal.
// FinalCta </main> -> Footer -> WatchModal.
export function PageBody() {
  const [watch, setWatch] = useState(false);
  const open = () => setWatch(true);

  return (
    <>
      <a href="#content" className="mkt-skip-link">
        Skip to main content
      </a>
      <ScrollProgress />
      <Nav onWatch={open} />

      <main id="content" className="min-h-screen bg-mkt-bg text-mkt-fg">
        <Hero onWatch={open} />
        <TrustStrip />
        <CapabilityStrip />

        <Connected />
        <Statement />
        <ProductExplorer />
        <BeforeAfter />

        <SocialProof />
        <Security />

        <Pricing />
        <Faq />
        <FinalCta onWatch={open} />
      </main>

      <Footer />

      {watch && (
        <Suspense fallback={null}>
          <WatchModal open onClose={() => setWatch(false)} />
        </Suspense>
      )}
    </>
  );
}
