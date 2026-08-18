import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        charcoal: "#333333",
        paper: "#faf8f4",
        "paper-dim": "#f1efe9",
        line: "#e2ded4",
        accent: "#0f4d3a",
        "accent-light": "#e8f0ec",
        // Resolves to a per-firm CSS variable set inline on the document
        // wrapper (see InvoiceDocument.tsx / QuotationDocument.tsx), falling
        // back to the default teal when no wrapper sets one.
        "inv-primary": "var(--brand-primary, #0F766E)",
        "inv-secondary": "#F8FAFC",
        "inv-accent": "#334155",
        "inv-success": "#16A34A",
        "inv-border": "#E5E7EB",
        // Marketing homepage (src/app/page.tsx + src/components/marketing/*)
        // only — resolves against the --mkt-* CSS variables in globals.css.
        // Not read by /dashboard or anywhere else in the app.
        "mkt-bg": "var(--mkt-bg)",
        "mkt-fg": "var(--mkt-fg)",
        "mkt-fg-2": "var(--mkt-fg-2)",
        "mkt-fg-muted": "var(--mkt-muted-fg)",
        "mkt-card": "var(--mkt-card)",
        "mkt-surface": "var(--mkt-surface)",
        "mkt-surface-2": "var(--mkt-surface-2)",
        "mkt-surface-3": "var(--mkt-surface-3)",
        "mkt-border": "var(--mkt-border)",
        "mkt-border-hi": "var(--mkt-border-hi)",
        "mkt-primary": "var(--mkt-primary)",
        "mkt-primary-fg": "var(--mkt-primary-fg)",
        "mkt-brand": "var(--mkt-brand)",
        "mkt-brand-mid": "var(--mkt-brand-mid)",
        "mkt-brand-lift": "var(--mkt-brand-lift)",
        "mkt-brand-deep": "var(--mkt-brand-deep)",
        "mkt-on-brand": "var(--mkt-on-brand)",
        "mkt-destructive": "var(--mkt-destructive)",
        "mkt-warn": "var(--mkt-warn)",
        "mkt-info": "var(--mkt-info)",
        "mkt-ring": "var(--mkt-ring)",
      },
      fontFamily: {
        "mkt-display": ["var(--font-inter-tight)", "system-ui", "sans-serif"],
        "mkt-sans": ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
