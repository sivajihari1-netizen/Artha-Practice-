"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Credential = {
  id: string;
  label: string;
  username: string | null;
  expiresAt: string | null;
};

export default function CredentialsPanel({
  clientId,
  credentials,
  canReveal,
}: {
  clientId: string;
  credentials: Credential[];
  canReveal: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, username: username || undefined, secret }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setLabel("");
    setUsername("");
    setSecret("");
    setOpen(false);
    router.refresh();
  }

  async function reveal(id: string) {
    const res = await fetch(`/api/credentials/${id}/reveal`);
    if (!res.ok) return;
    const data = await res.json();
    setRevealed((prev) => ({ ...prev, [id]: data.secret }));
  }

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">Credentials Vault</h3>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-accent">
          {open ? "Cancel" : "+ Add"}
        </button>
      </div>

      {open && (
        <form onSubmit={onSubmit} className="space-y-2 mb-4 border-b border-line pb-4">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1">{error}</div>}
          <input placeholder="Label (e.g. GST Portal)" required value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          <input placeholder="Username (optional)" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          <input placeholder="Password / secret" type="password" required value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
            {loading ? "Saving…" : "Save Credential"}
          </button>
        </form>
      )}

      {credentials.length === 0 ? (
        <p className="text-xs text-gray-400">No credentials stored yet.</p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((c) => (
            <li key={c.id} className="flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{c.label}</div>
                <div className="text-xs text-gray-500">
                  {c.username ?? "—"} · {revealed[c.id] ? revealed[c.id] : "••••••••"}
                </div>
              </div>
              {canReveal && !revealed[c.id] && (
                <button onClick={() => reveal(c.id)} className="text-xs text-accent font-medium">
                  Reveal
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
