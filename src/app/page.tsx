import type { Metadata } from "next";
import { interTight, interSans } from "@/components/marketing/fonts";
import { PageBody } from "@/components/marketing/PageBody";

// Public marketing homepage — a port of a Lovable/TanStack Start reference
// design into this app's real architecture (see src/components/marketing/*
// for the per-component sourcing/adaptation notes). Fully static: no Prisma
// import, no getSession, no server-side data fetch of any kind anywhere in
// this file or its children — every name/number/mock screenshot is
// hardcoded illustrative content. The logged-in-visitor redirect to
// /dashboard lives in src/middleware.ts, not here, since a page.tsx can't
// also be a Route Handler and this page must stay session-free.
//
// This file itself must stay a Server Component (Next.js disallows
// `export const metadata` in a "use client" file) — the useState-driven
// "Watch Artha in Action" modal state lives in PageBody.tsx instead, which
// is the actual Client Component boundary.
export const metadata: Metadata = {
  title: "Artha — CA Practice Management Software for Indian CA Firms",
  description:
    "Clients, compliance, tasks, documents, billing and GST reconciliation in one workspace built for Indian CA firms. 30-day free trial, no credit card.",
  alternates: { canonical: "https://arthapractice.in/" },
  openGraph: {
    type: "website",
    url: "https://arthapractice.in/",
    siteName: "Artha",
    title: "Artha — CA Practice Management Software for Indian CA Firms",
    description: "Clients, compliance, tasks, documents, billing and GST reconciliation in one workspace built for Indian CA firms.",
    images: [{ url: "https://arthapractice.in/screenshots/dashboard-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Artha — CA Practice Management Software for Indian CA Firms",
    description: "Clients, compliance, tasks, documents, billing and GST reconciliation in one workspace.",
    images: ["https://arthapractice.in/screenshots/dashboard-og.png"],
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Artha",
  url: "https://arthapractice.in",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  // Verified against prisma/seed.ts -> Plan table this session — no discrepancy found.
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "INR",
    lowPrice: "1000",
    highPrice: "27000",
    offerCount: "5",
  },
};

export default function Home() {
  return (
    <div className={`mkt-page ${interTight.variable} ${interSans.variable} font-mkt-sans bg-mkt-bg text-mkt-fg`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <PageBody />
    </div>
  );
}
