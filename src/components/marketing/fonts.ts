import { Inter, Inter_Tight } from "next/font/google";

// Self-hosted via next/font (no external CDN request, unlike the Lovable
// source's raw Google Fonts <link>) — scoped to the marketing page only via
// these .variable class names, applied on the page's own wrapper div, not
// on <body> in the shared root layout. /dashboard and every other route is
// completely unaffected and keeps its existing system-font stack.
export const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const interSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});
