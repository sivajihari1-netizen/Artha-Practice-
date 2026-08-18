"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="border border-inv-border rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-inv-secondary"
    >
      Print
    </button>
  );
}
