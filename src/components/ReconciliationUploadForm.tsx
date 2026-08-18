"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  isAcceptedExtension,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_LABEL,
  sourceAAccept,
  SOURCE_B_ACCEPT,
  type ReconciliationTypeValue,
} from "@/lib/reconciliationUpload";
import { RECONCILIATION_TYPE_LABEL, SOURCE_A_LABEL, SOURCE_B_LABEL } from "@/lib/reconciliationLabels";

const TYPES: ReconciliationTypeValue[] = ["GST_2B_VS_PURCHASE", "GST_1_VS_SALES", "BANK_VS_BOOKS"];

type ClientOption = { id: string; name: string };

// F2.4/F2.5 — uploads through the existing, unmodified
// POST /api/clients/[id]/reconciliation-runs. This form never bypasses that
// route: it just builds the same multipart FormData the route already
// expects. Client selection is restricted to the firm-scoped `clients` prop
// (fetched server-side by the page, same client.findMany({select:{id,name}})
// pattern as F1) — the browser never supplies a firmId, and the route itself
// independently re-validates clientId ownership regardless.
export default function ReconciliationUploadForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<ReconciliationTypeValue>("GST_2B_VS_PURCHASE");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [sourceAFile, setSourceAFile] = useState<File | null>(null);
  const [sourceBFile, setSourceBFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = sourceAAccept(type);

  function onTypeChange(next: ReconciliationTypeValue) {
    setType(next);
    setSourceAFile(null); // the accepted extensions for source A change with type — a stale file selection could otherwise look valid but isn't
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side checks are a UX convenience only — the API route performs
    // the authoritative validation regardless (extension, size, client
    // ownership). Never trust the browser's MIME type for security; these
    // checks are all filename/size based, same as the server's own.
    if (!clientId) return setError("Select a client.");
    if (!sourceAFile || !sourceBFile) return setError(`Both ${SOURCE_A_LABEL[type]} and ${SOURCE_B_LABEL[type]} are required.`);
    if (!isAcceptedExtension(sourceAFile.name, accept)) return setError(`${SOURCE_A_LABEL[type]} must be one of: ${accept}`);
    if (!isAcceptedExtension(sourceBFile.name, SOURCE_B_ACCEPT)) return setError(`${SOURCE_B_LABEL[type]} must be one of: ${SOURCE_B_ACCEPT}`);
    if (sourceAFile.size > MAX_UPLOAD_SIZE_BYTES || sourceBFile.size > MAX_UPLOAD_SIZE_BYTES) {
      return setError(`Each file must be under ${MAX_UPLOAD_SIZE_LABEL}.`);
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("type", type);
    formData.append("periodStart", new Date(periodStart).toISOString());
    formData.append("periodEnd", new Date(periodEnd).toISOString());
    formData.append("sourceAFile", sourceAFile);
    formData.append("sourceBFile", sourceBFile);

    const res = await fetch(`/api/clients/${clientId}/reconciliation-runs`, { method: "POST", body: formData });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed");
      return;
    }
    const data = await res.json();
    router.push(`/dashboard/reconciliation/runs/${data.run.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="border border-line rounded-xl bg-white p-5 space-y-3 max-w-xl">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div>
        <label className="block text-xs font-medium mb-1">Client</label>
        <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm">
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Reconciliation type</label>
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value as ReconciliationTypeValue)}
          className="w-full border border-line rounded-md px-3 py-2 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>{RECONCILIATION_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Period start</label>
          <input type="date" required value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Period end</label>
          <input type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-full border border-line rounded-md px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">{SOURCE_A_LABEL[type]}</label>
        <input type="file" accept={accept} required onChange={(e) => setSourceAFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{SOURCE_B_LABEL[type]}</label>
        <input type="file" accept={SOURCE_B_ACCEPT} required onChange={(e) => setSourceBFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
      </div>

      <p className="text-xs text-gray-400">
        Supported formats: CSV, Excel (.xlsx/.xls){type === "GST_2B_VS_PURCHASE" ? ", JSON (GSTR-2B export only)" : ""}. Maximum file
        size: {MAX_UPLOAD_SIZE_LABEL} per file.
      </p>

      <button type="submit" disabled={loading} className="bg-accent text-white rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {loading ? "Uploading…" : "Upload & Reconcile"}
      </button>
    </form>
  );
}
