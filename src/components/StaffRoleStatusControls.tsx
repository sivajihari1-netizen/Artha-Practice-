"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "PARTNER" | "MANAGER" | "STAFF";
const ROLES: Role[] = ["PARTNER", "MANAGER", "STAFF"];

/**
 * Staff role/status management (Batch A) — the Role and Status cells for one
 * staff row, wired to the existing PATCH /api/staff/[id] (unchanged; this
 * component adds no new endpoint and no new business rule). Only ever
 * rendered for a PARTNER viewer, and never for a Partner's own row — see
 * staff/page.tsx, which is where that gating actually happens. The backend
 * route's own `role !== "PARTNER"` check remains the real authorization
 * boundary regardless of what this component renders.
 */
export default function StaffRoleStatusControls({
  staffId,
  role,
  active,
}: {
  staffId: string;
  role: Role;
  active: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(data: { role?: Role; active?: boolean }) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not update");
      return;
    }
    router.refresh();
  }

  function onRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Role;
    if (next === role) return;
    update({ role: next });
  }

  function onToggleActive() {
    // Same confirm() pattern already used for the app's other sensitive,
    // hard-to-undo-by-yourself action (document delete) — deactivation
    // revokes login access, reactivation doesn't need the same friction.
    if (active && !confirm("Deactivate this staff member? They will no longer be able to log in.")) return;
    update({ active: !active });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        onChange={onRoleChange}
        disabled={loading}
        className="text-xs border border-line rounded px-1.5 py-1 disabled:opacity-60"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button
        onClick={onToggleActive}
        disabled={loading}
        title={active ? "Click to deactivate" : "Click to reactivate"}
        className={`text-xs font-semibold px-2 py-1 rounded-full disabled:opacity-60 ${
          active ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600" : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700"
        }`}
      >
        {loading ? "…" : active ? "Active" : "Disabled"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
