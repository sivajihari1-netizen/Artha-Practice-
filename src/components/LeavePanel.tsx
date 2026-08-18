"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LeaveRequest = {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  user: { name: string };
};

export default function LeavePanel({ requests, canApprove }: { requests: LeaveRequest[]; canApprove: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDate: new Date(fromDate).toISOString(),
        toDate: new Date(toDate).toISOString(),
        reason: reason || undefined,
      }),
    });
    setLoading(false);
    setFromDate("");
    setToDate("");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Leave Requests</h3>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-accent">
          {open ? "Cancel" : "+ Apply for Leave"}
        </button>
      </div>

      {open && (
        <form onSubmit={apply} className="space-y-2 mb-4 border-b border-line pb-4">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" required value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm" />
            <input type="date" required value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm" />
          </div>
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-xs text-gray-400">No leave requests.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.user.name}</div>
                <div className="text-xs text-gray-500">
                  {new Date(r.fromDate).toLocaleDateString("en-IN")} – {new Date(r.toDate).toLocaleDateString("en-IN")}
                  {r.reason ? ` · ${r.reason}` : ""}
                </div>
              </div>
              {canApprove && r.status === "PENDING" ? (
                <div className="flex gap-2">
                  <button onClick={() => decide(r.id, "APPROVED")} className="text-xs text-green-700 font-medium">Approve</button>
                  <button onClick={() => decide(r.id, "REJECTED")} className="text-xs text-red-600 font-medium">Reject</button>
                </div>
              ) : (
                <span className={`text-xs font-medium ${
                  r.status === "APPROVED" ? "text-green-700" : r.status === "REJECTED" ? "text-red-600" : "text-gray-500"
                }`}>
                  {r.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
