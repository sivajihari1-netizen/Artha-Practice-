"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddContactForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/clients/${clientId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, designation: designation || undefined, phone: phone || undefined, email: email || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setName("");
      setDesignation("");
      setPhone("");
      setEmail("");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-accent">
        + Add
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 mb-3 border-b border-line pb-3">
      <input placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <input placeholder="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
      <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
        {loading ? "Saving…" : "Save Contact"}
      </button>
    </form>
  );
}
