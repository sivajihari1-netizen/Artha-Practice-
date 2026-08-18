"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Ported from the Lovable reference build's primitives.tsx, adapted from
// Tailwind v4 semantic classes (bg-background, text-foreground, etc.) to
// this project's mkt-* prefixed tokens (see globals.css) — logic unchanged.

const RM_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeRM(cb: () => void) {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** True when the user asked the OS to reduce motion. SSR-safe (false on server). */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeRM,
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}

export function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -5% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** One consistent vertical rhythm for every section — see globals.css --mkt-rhythm. */
export function Section({
  id,
  className,
  pad = "default",
  bleed = false,
  rule = false,
  children,
}: {
  id?: string;
  className?: string;
  pad?: "none" | "tight" | "default";
  bleed?: boolean;
  rule?: boolean;
  children: React.ReactNode;
}) {
  const pads = {
    none: "py-0",
    tight: "py-8 md:py-10",
    default: "py-[var(--mkt-rhythm-sm)] md:py-[var(--mkt-rhythm)]",
  }[pad];

  return (
    <section
      id={id}
      className={cn(
        "w-full",
        bleed ? "mx-0 max-w-none px-0" : "mx-auto max-w-[1180px] px-5",
        pads,
        rule && "border-t border-mkt-border",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Inner({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1180px] px-5", className)}>{children}</div>;
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mkt-label-eyebrow mb-3 text-mkt-primary">{children}</p>;
}

export function Dim({ children }: { children: React.ReactNode }) {
  return <span className="text-mkt-fg-muted">{children}</span>;
}

export function Body({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mt-10 md:mt-12", className)}>{children}</div>;
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl border border-mkt-border bg-mkt-surface", className)}>{children}</div>;
}

type BtnOwnProps = {
  variant?: "primary" | "ghost" | "quiet";
  size?: "md" | "sm";
  href?: string;
  className?: string;
  children?: React.ReactNode;
};

/* Primary buttons fill with the brand green (--mkt-brand-mid) with white
   text on it (8:1+ contrast); the bright mint --mkt-primary stays reserved
   for marks (text/icons), never as a button fill on this dark canvas. */
const btnClasses = (variant: BtnOwnProps["variant"], size: BtnOwnProps["size"], className?: string) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-ring",
    size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-11 px-5 text-[14px]",
    variant === "ghost" &&
      "border border-mkt-border-hi bg-mkt-surface-2 text-mkt-fg hover:border-mkt-primary/50 hover:bg-mkt-surface-3",
    variant === "quiet" && "text-mkt-fg-muted hover:text-mkt-fg",
    (!variant || variant === "primary") &&
      "bg-mkt-brand-mid text-mkt-on-brand hover:bg-mkt-brand-lift hover:shadow-[0_10px_30px_-12px_var(--mkt-glow)]",
    className,
  );

/** Real <button> or real <a> — never a styled div. */
export function Btn({
  variant = "primary",
  size = "md",
  href,
  className,
  children,
  ...rest
}: BtnOwnProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BtnOwnProps> & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof BtnOwnProps>) {
  if (href) {
    return (
      <a href={href} className={btnClasses(variant, size, className)} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={btnClasses(variant, size, className)} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "high" | "medium" | "low" | "info" | "accent";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-mkt-surface-3 text-mkt-fg-muted",
    high: "bg-[var(--mkt-danger-wash)] text-mkt-destructive",
    medium: "bg-[var(--mkt-warn-wash)] text-mkt-warn",
    low: "bg-[var(--mkt-wash-hi)] text-mkt-primary",
    info: "bg-[var(--mkt-info-wash)] text-mkt-info",
    accent: "bg-[var(--mkt-wash-hi)] text-mkt-primary",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[9.5px] font-semibold tracking-[0.06em] uppercase", tones[tone])}>
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: "high" | "medium" | "low" | "info" | "accent" }) {
  const c = {
    high: "bg-mkt-destructive",
    medium: "bg-mkt-warn",
    low: "bg-mkt-primary",
    info: "bg-mkt-info",
    accent: "bg-mkt-primary",
  }[tone];
  return <span className={cn("size-1.5 shrink-0 rounded-full", c)} />;
}

export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.18);
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 [transition-timing-function:cubic-bezier(0.2,0.7,0.3,1)]",
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Spotlight({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mkt-mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--mkt-my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "mkt-spotlight rounded-2xl border border-mkt-border bg-mkt-surface transition-colors duration-300 hover:border-mkt-border-hi",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CountUp({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 1200,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);
  return (
    <span ref={ref} className={cn("mkt-num", className)}>
      {prefix}
      {(decimals === 0 ? Math.round(val) : val).toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/** Thin top-of-page reading progress bar. */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      raf = 0;
      const el = bar.current;
      if (!el) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      el.style.transform = `scaleX(${p})`;
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]">
      <div ref={bar} className="h-full w-full origin-left bg-mkt-primary/80" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}

/** Button wrapper that leans toward the cursor (pointer devices only, no-op under reduced motion). */
export function Magnetic({
  strength = 8,
  className,
  children,
}: {
  strength?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reduced = usePrefersReducedMotion();
  if (reduced) return <span className={cn("inline-block", className)}>{children}</span>;
  return (
    <span
      ref={ref}
      className={cn("inline-block transition-transform duration-200 ease-out will-change-transform", className)}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength * 0.5}px)`;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = "translate(0,0)";
      }}
    >
      {children}
    </span>
  );
}
