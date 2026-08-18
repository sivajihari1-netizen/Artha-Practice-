"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AttendanceWidget({ checkedIn }: { checkedIn: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: checkedIn ? "checkout" : "checkin" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-md px-4 py-2 text-sm font-semibold ${
        checkedIn ? "bg-ink text-white" : "bg-accent text-white"
      } disabled:opacity-60`}
    >
      {loading ? "…" : checkedIn ? "Check Out" : "Check In"}
    </button>
  );
}
