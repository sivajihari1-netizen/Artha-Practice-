"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScopeItem, FeeItem, TermItem, StatHighlight } from "@/lib/quotationPresets";

type Quotation = {
  id: string;
  title: string;
  subtitle: string | null;
  preparedByName: string | null;
  introNote: string | null;
  validUntil: string | null;
  statHighlights: StatHighlight[];
  aboutPoints: ScopeItem[];
  scopeItems: ScopeItem[];
  feeItems: FeeItem[];
  termsItems: TermItem[];
};

export default function QuotationEditForm({ quotation, canEdit }: { quotation: Quotation; canEdit: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(quotation.title);
  const [subtitle, setSubtitle] = useState(quotation.subtitle ?? "");
  const [preparedByName, setPreparedByName] = useState(quotation.preparedByName ?? "");
  const [introNote, setIntroNote] = useState(quotation.introNote ?? "");
  const [validUntil, setValidUntil] = useState(quotation.validUntil ? quotation.validUntil.slice(0, 10) : "");
  const [statHighlights, setStatHighlights] = useState<StatHighlight[]>(quotation.statHighlights);
  const [aboutPoints, setAboutPoints] = useState<ScopeItem[]>(quotation.aboutPoints);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>(quotation.scopeItems);
  const [feeItems, setFeeItems] = useState<FeeItem[]>(quotation.feeItems);
  const [termsItems, setTermsItems] = useState<TermItem[]>(quotation.termsItems);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setLoading(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/quotations/${quotation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, subtitle: subtitle || undefined, preparedByName: preparedByName || undefined, introNote: introNote || undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
        // Keep a row if ANY field has content — requiring every field would
        // silently discard a row the moment it's only half-filled-in, which
        // looks like "I typed it and it vanished."
        statHighlights: statHighlights.filter((s) => s.label || s.value),
        aboutPoints: aboutPoints.filter((a) => a.title || a.description),
        scopeItems: scopeItems.filter((s) => s.title || s.description),
        feeItems: feeItems.filter((f) => f.particulars || f.fee),
        termsItems: termsItems.filter((t) => t.label || t.description),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const disabled = !canEdit || loading;

  return (
    <div className="border border-line rounded-xl bg-white p-5 space-y-5">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {saved && <div className="text-sm text-accent bg-accent-light border border-line rounded-md px-3 py-2">Saved.</div>}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Title</label>
          <input disabled={disabled} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Subtitle</label>
          <input disabled={disabled} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Prepared By</label>
          <input disabled={disabled} value={preparedByName} onChange={(e) => setPreparedByName(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Valid Until</label>
          <input disabled={disabled} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Introduction Note</label>
        <textarea disabled={disabled} value={introNote} onChange={(e) => setIntroNote(e.target.value)} rows={4} className="w-full border border-line rounded-md px-3 py-2 text-sm disabled:bg-paper-dim" />
      </div>

      {/* Stat highlights */}
      <ListEditor
        label="Firm-at-a-Glance Stats"
        items={statHighlights}
        disabled={disabled}
        onChange={setStatHighlights}
        empty={{ label: "", value: "" }}
        renderRow={(item, update) => (
          <>
            <input disabled={disabled} placeholder="Value (e.g. 6+)" value={item.value} onChange={(e) => update({ ...item, value: e.target.value })} className="w-24 border border-line rounded-md px-2 py-1.5 text-sm" />
            <input disabled={disabled} placeholder="Label (e.g. Years of Experience)" value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} className="flex-1 border border-line rounded-md px-2 py-1.5 text-sm" />
          </>
        )}
      />

      {/* About points */}
      <ListEditor
        label="Why Choose Us"
        items={aboutPoints}
        disabled={disabled}
        onChange={setAboutPoints}
        empty={{ title: "", description: "" }}
        renderRow={(item, update) => (
          <div className="flex-1 space-y-1">
            <input disabled={disabled} placeholder="Title" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} className="w-full border border-line rounded-md px-2 py-1.5 text-sm font-medium" />
            <input disabled={disabled} placeholder="Description" value={item.description} onChange={(e) => update({ ...item, description: e.target.value })} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          </div>
        )}
      />

      {/* Scope of services */}
      <ListEditor
        label="Scope of Services"
        items={scopeItems}
        disabled={disabled}
        onChange={setScopeItems}
        empty={{ title: "", description: "" }}
        renderRow={(item, update) => (
          <div className="flex-1 space-y-1">
            <input disabled={disabled} placeholder="Title (e.g. Accounting & Financial Management)" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} className="w-full border border-line rounded-md px-2 py-1.5 text-sm font-medium" />
            <textarea disabled={disabled} placeholder="Description" value={item.description} onChange={(e) => update({ ...item, description: e.target.value })} rows={2} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          </div>
        )}
      />

      {/* Fee items */}
      <ListEditor
        label="Fee"
        items={feeItems}
        disabled={disabled}
        onChange={setFeeItems}
        empty={{ particulars: "", fee: 0, frequency: "Monthly" }}
        renderRow={(item, update) => (
          <>
            <input disabled={disabled} placeholder="Particulars" value={item.particulars} onChange={(e) => update({ ...item, particulars: e.target.value })} className="flex-1 border border-line rounded-md px-2 py-1.5 text-sm" />
            <input disabled={disabled} type="number" min="0" placeholder="Fee" value={item.fee} onChange={(e) => update({ ...item, fee: parseFloat(e.target.value) || 0 })} className="w-24 border border-line rounded-md px-2 py-1.5 text-sm" />
            <select disabled={disabled} value={item.frequency} onChange={(e) => update({ ...item, frequency: e.target.value })} className="w-28 border border-line rounded-md px-2 py-1.5 text-sm">
              {["One-time", "Monthly", "Quarterly", "Annual"].map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </>
        )}
      />

      {/* Terms */}
      <ListEditor
        label="Terms & Conditions"
        items={termsItems}
        disabled={disabled}
        onChange={setTermsItems}
        empty={{ label: "", description: "" }}
        renderRow={(item, update) => (
          <div className="flex-1 space-y-1">
            <input disabled={disabled} placeholder="Label (e.g. Services)" value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} className="w-full border border-line rounded-md px-2 py-1.5 text-sm font-medium" />
            <textarea disabled={disabled} placeholder="Description" value={item.description} onChange={(e) => update({ ...item, description: e.target.value })} rows={2} className="w-full border border-line rounded-md px-2 py-1.5 text-sm" />
          </div>
        )}
      />

      {canEdit && (
        <button onClick={onSave} disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
          {loading ? "Saving…" : "Save Changes"}
        </button>
      )}
    </div>
  );
}

function ListEditor<T>({
  label, items, disabled, onChange, empty, renderRow,
}: {
  label: string;
  items: T[];
  disabled: boolean;
  onChange: (items: T[]) => void;
  empty: T;
  renderRow: (item: T, update: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="border-t border-line pt-4">
      <label className="block text-xs font-semibold mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            {renderRow(item, (next) => onChange(items.map((it, i) => (i === idx ? next : it))))}
            {!disabled && (
              <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))} className="text-xs text-gray-400 px-1 shrink-0 mt-1.5">✕</button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <button type="button" onClick={() => onChange([...items, empty])} className="text-xs text-accent font-medium mt-2">
          + Add row
        </button>
      )}
    </div>
  );
}
