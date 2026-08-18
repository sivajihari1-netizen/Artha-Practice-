"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Template = {
  id: string;
  title: string;
  returnType: string;
  recurrence: string;
  active: boolean;
};

const RETURN_TYPES = ["GST", "TDS", "ITR", "ROC", "AUDIT", "OTHER"];
const RECURRENCES = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"];

export default function TaskTemplateRow({
  template,
  formatRecurrence,
}: {
  template: Template;
  formatRecurrence: (recurrence: string) => string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(template.title);
  const [returnType, setReturnType] = useState(template.returnType);
  const [recurrence, setRecurrence] = useState(template.recurrence);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MCA-seeded templates use fixed-date recurrences like "ANNUAL:10-30",
  // which aren't in the 4 generic options below — include the current value
  // so hitting Save without touching this field can't silently corrupt it.
  const recurrenceOptions = RECURRENCES.includes(recurrence) ? RECURRENCES : [recurrence, ...RECURRENCES];

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/task-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveEdit() {
    const ok = await patch({ title, returnType, recurrence });
    if (ok) setEditing(false);
  }

  function cancelEdit() {
    setTitle(template.title);
    setReturnType(template.returnType);
    setRecurrence(template.recurrence);
    setError(null);
    setEditing(false);
  }

  async function toggleActive() {
    if (
      template.active &&
      !confirm(`Deactivate "${template.title}"? No new tasks will be generated from it going forward — tasks it already created are untouched.`)
    ) {
      return;
    }
    await patch({ active: !template.active });
  }

  if (editing) {
    return (
      <tr className="border-t border-line bg-paper-dim/40">
        <td className="px-4 py-3" colSpan={5}>
          {error && <div className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">{error}</div>}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border border-line rounded-md px-2 py-1.5 text-sm"
            />
            <select value={returnType} onChange={(e) => setReturnType(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
              {RETURN_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="border border-line rounded-md px-2 py-1.5 text-sm">
              {recurrenceOptions.map((r) => (
                <option key={r} value={r}>{formatRecurrence(r)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={saveEdit} disabled={saving} className="text-xs font-semibold text-accent disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancelEdit} disabled={saving} className="text-xs text-gray-400 disabled:opacity-60">
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3">{template.title}</td>
      <td className="px-4 py-3 text-gray-500">{template.returnType}</td>
      <td className="px-4 py-3 text-gray-500">{formatRecurrence(template.recurrence)}</td>
      <td className="px-4 py-3 text-gray-500">{template.active ? "Active" : "Inactive"}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {error && <div className="mb-1 text-xs text-red-600">{error}</div>}
        <button onClick={() => setEditing(true)} className="text-xs font-semibold text-accent mr-3">
          Edit
        </button>
        <button onClick={toggleActive} disabled={saving} className="text-xs font-semibold text-gray-500 hover:text-charcoal disabled:opacity-60">
          {saving ? "…" : template.active ? "Deactivate" : "Reactivate"}
        </button>
      </td>
    </tr>
  );
}
