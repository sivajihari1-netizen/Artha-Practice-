"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { leadNotePreview } from "@/lib/leadNotes";
import ActivityTimeline from "@/components/ActivityTimeline";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  stage: "NEW" | "CONTACTED" | "PROPOSAL_SENT" | "WON" | "LOST";
  notes: string | null;
};

const STAGES: Lead["stage"][] = ["NEW", "CONTACTED", "PROPOSAL_SENT", "WON", "LOST"];
const STAGE_LABELS: Record<Lead["stage"], string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};

const ACTIVE_STAGES: Lead["stage"][] = ["NEW", "CONTACTED", "PROPOSAL_SENT", "WON"];

export default function LeadsBoard({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Archived (Lost) column decluttering (Batch C) — moving a lead to Lost
  // already fully worked via the stage select below; what didn't exist was
  // any way to keep a growing pile of lost leads out of the way. Hidden by
  // default, one click to reveal — nothing is ever deleted either way.
  const [showArchived, setShowArchived] = useState(false);
  const lostCount = leads.filter((l) => l.stage === "LOST").length;
  const visibleStages = showArchived ? STAGES : ACTIVE_STAGES;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Which card's notes editor is expanded, and its in-progress draft — one
  // at a time, keyed by lead id, so the board doesn't need per-card state.
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Which card's activity history is expanded — same one-at-a-time pattern
  // as notes above. History fetches lazily (see ActivityTimeline's `lazy`
  // prop) only once opened, not for every card on the board.
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: phone || undefined, email: email || undefined, notes: notes || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setOpen(false);
      router.refresh();
    }
  }

  async function changeStage(id: string, stage: Lead["stage"]) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    router.refresh();
  }

  /** Explicit, confirmed "Archive" action (Batch C) — reuses changeStage/the same PATCH the stage <select> already calls; LOST was always a valid stage, this just gives it a clear, deliberate entry point instead of only a generic dropdown option. */
  function archiveLead(lead: Lead) {
    if (!confirm(`Archive "${lead.name}"? This marks the lead as Lost — nothing is deleted, and it can be moved back to an active stage at any time.`)) {
      return;
    }
    changeStage(lead.id, "LOST");
  }

  function startEditingNotes(lead: Lead) {
    setEditingNotesId(lead.id);
    setDraftNote(lead.notes ?? "");
  }

  async function saveNotes(id: string) {
    setSavingNotes(true);
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: draftNote }),
    });
    setSavingNotes(false);
    if (res.ok) {
      setEditingNotesId(null);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Leads</h1>
          <p className="text-sm text-gray-500">
            Track prospects before they become clients.
            {lostCount > 0 && (
              <>
                {" · "}
                <button onClick={() => setShowArchived((s) => !s)} className="text-accent font-medium">
                  {showArchived ? "Hide archived" : `Show archived (${lostCount})`}
                </button>
              </>
            )}
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="bg-ink text-white rounded-md px-4 py-2 text-sm font-semibold">
          {open ? "Cancel" : "+ Add Lead"}
        </button>
      </div>

      {open && (
        <form onSubmit={addLead} className="border border-line rounded-xl p-5 bg-white mb-6 space-y-3">
          <input placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
          <textarea
            placeholder="Notes (optional) — e.g. how you met, what they need, budget signals"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-line rounded-md px-3 py-2 text-sm"
          />
          <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
            {loading ? "Saving…" : "Save Lead"}
          </button>
        </form>
      )}

      <div className={`grid gap-3 ${showArchived ? "grid-cols-5" : "grid-cols-4"}`}>
        {visibleStages.map((stage) => (
          <div key={stage} className="border border-line rounded-xl bg-white p-3 min-h-[200px]">
            <div className="text-xs font-bold text-gray-500 mb-2">{STAGE_LABELS[stage]}</div>
            <div className="space-y-2">
              {leads.filter((l) => l.stage === stage).map((l) => (
                <div key={l.id} className="border border-line rounded-lg p-2 text-xs">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-gray-500">{l.phone ?? l.email ?? ""}</div>
                  <select
                    value={l.stage}
                    onChange={(e) => changeStage(l.id, e.target.value as Lead["stage"])}
                    className="mt-1 w-full border border-line rounded px-1 py-0.5 text-xs"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                    ))}
                  </select>

                  {editingNotesId === l.id ? (
                    <div className="mt-1.5">
                      <textarea
                        autoFocus
                        rows={3}
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="Met CFO on Tuesday. Budget approved. Follow up after 15 August."
                        className="w-full border border-line rounded px-1.5 py-1 text-xs"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => saveNotes(l.id)}
                          disabled={savingNotes}
                          className="text-xs font-semibold text-accent disabled:opacity-60"
                        >
                          {savingNotes ? "Saving…" : "Save"}
                        </button>
                        <button onClick={() => setEditingNotesId(null)} disabled={savingNotes} className="text-xs text-gray-400 disabled:opacity-60">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startEditingNotes(l)} className="mt-1.5 block w-full text-left text-gray-500 hover:text-charcoal">
                      {l.notes ? <>📝 {leadNotePreview(l.notes)}</> : <span className="text-gray-300">+ Add note</span>}
                    </button>
                  )}

                  <div className="mt-1.5 flex items-center justify-between">
                    <button
                      onClick={() => setHistoryOpenId(historyOpenId === l.id ? null : l.id)}
                      className="text-gray-400 hover:text-charcoal"
                    >
                      {historyOpenId === l.id ? "Hide history" : "History"}
                    </button>
                    {stage !== "LOST" && (
                      <button onClick={() => archiveLead(l)} className="text-gray-400 hover:text-red-600">
                        Archive
                      </button>
                    )}
                  </div>
                  {historyOpenId === l.id && (
                    <div className="mt-1.5 border-t border-line pt-1.5">
                      <ActivityTimeline entityType="LEAD" entityId={l.id} initialActivities={[]} initialNextCursor={null} compact lazy />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
