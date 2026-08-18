"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ArthaDashboard, useDashboardCycle } from "./Dashboard";

const STEPS = [
  "Dashboard — morning view",
  "Attention detected",
  "Risk scored high",
  "Task created",
  "Assigned & in overdue work",
  "Resolved",
];

// Adapted from the Lovable source, which had Escape + backdrop-click but no
// focus trap or focus restoration — added here since the brief explicitly
// requires both.
export function WatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const step = useDashboardCycle(open, 2400);
  const [t, setT] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    setT(0);
    const i = setInterval(() => setT((n) => n + 1), 1000);
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(i);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      lastFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-mkt-bg/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-modal-title"
        className="max-h-[85vh] w-full max-w-[1080px] overflow-y-auto rounded-2xl border border-mkt-border bg-mkt-surface p-5 shadow-[var(--mkt-shadow-elegant)] md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p id="watch-modal-title" className="mkt-label-eyebrow text-mkt-primary">
              Watch Artha work
            </p>
            <p className="mkt-num text-[12px] text-mkt-fg-muted">00:{String(t % 60).padStart(2, "0")}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close the Artha walkthrough"
            className="grid size-9 place-items-center rounded-lg border border-mkt-border text-mkt-fg-muted transition-colors hover:text-mkt-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mkt-ring"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
          <ArthaDashboard step={step} />
          <ol aria-label="Walkthrough steps" className="flex flex-col gap-2">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "rounded-lg border px-3.5 py-3 text-[12.5px] transition-all duration-300",
                  i === step
                    ? "border-mkt-primary bg-[var(--mkt-wash)] text-mkt-fg"
                    : i < step
                      ? "border-mkt-border bg-mkt-surface-2 text-mkt-fg-muted"
                      : "border-mkt-border bg-mkt-surface-2 text-mkt-fg-muted opacity-50",
                )}
              >
                <span className="mkt-num mr-2 text-mkt-primary">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
