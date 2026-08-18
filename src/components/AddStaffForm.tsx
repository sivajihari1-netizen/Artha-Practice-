"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddStaffForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="bg-ink text-white rounded-md px-4 py-2 text-sm font-semibold">
        + Add Staff
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl p-5 bg-white mb-6 space-y-3">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
          <option value="STAFF">Staff</option>
          <option value="MANAGER">Manager</option>
        </select>
        <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm col-span-2" />
        <input type="password" placeholder="Temporary password (min 8 chars)" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm col-span-2" />
      </div>
      <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {loading ? "Saving…" : "Create Account"}
      </button>
    </form>
  );
}
