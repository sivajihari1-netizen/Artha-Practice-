"use client";

import { useRouter } from "next/navigation";
import { formatDocRequestSummary } from "@/lib/taskBoard";

type Doc = { id: string; fileName: string; category: string; sizeBytes: number | null };
type Item = { id: string; label: string; fulfilled: boolean };
type Request = { id: string; status: "PENDING" | "PARTIAL" | "COMPLETE" | "EXPIRED"; items: Item[] };

const STATUS_COLOR: Record<Request["status"], string> = {
  PENDING: "text-gray-500",
  PARTIAL: "text-amber-600",
  COMPLETE: "text-accent",
  EXPIRED: "text-red-600",
};

/**
 * Task 360's merged Documents section (audit §3: DocumentRequests + Documents
 * are one coherent question, not two). Read-oriented — creating a new
 * request stays on the Client 360 page (DocumentRequestsPanel) so there's
 * only one place that owns that workflow; this reuses the same underlying
 * endpoints (download/replace/remind) rather than duplicating their logic.
 */
export default function TaskDocumentsSection({ documents, documentRequests }: { documents: Doc[]; documentRequests: Request[] }) {
  const router = useRouter();

  const allItems = documentRequests.flatMap((r) => r.items);
  const summary = formatDocRequestSummary(allItems.length > 0 ? { total: allItems.length, fulfilled: allItems.filter((i) => i.fulfilled).length } : null);

  async function download(id: string) {
    const res = await fetch(`/api/documents/${id}/download`);
    if (!res.ok) return;
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  async function replace(id: string, newFile: File) {
    const formData = new FormData();
    formData.append("file", newFile);
    const res = await fetch(`/api/documents/${id}/replace`, { method: "POST", body: formData });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Replace failed");
    }
  }

  async function remind(id: string) {
    await fetch(`/api/document-requests/${id}/remind`, { method: "POST" });
    router.refresh();
  }

  return (
    <div>
      {summary && (
        <div className={`text-sm font-medium mb-3 ${summary.outstanding > 0 ? "text-amber-600" : "text-green-700"}`}>{summary.label}</div>
      )}

      {documentRequests.length === 0 && documents.length === 0 && (
        <p className="text-xs text-gray-400">No documents requested or received for this task yet.</p>
      )}

      {documentRequests.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold text-gray-500 mb-1.5">Requested</div>
          <ul className="space-y-2">
            {documentRequests.map((r) => (
              <li key={r.id} className="border border-line rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                  {r.status !== "COMPLETE" && r.status !== "EXPIRED" && (
                    <button onClick={() => remind(r.id)} className="text-xs text-accent font-medium">Remind</button>
                  )}
                </div>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {r.items.map((item) => (
                    <li key={item.id}>{item.fulfilled ? "✓" : "○"} {item.label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {documents.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-500 mb-1.5">Received</div>
          <ul className="space-y-1.5">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{d.fileName}</div>
                  <div className="text-xs text-gray-500">
                    {d.category} · {d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <button onClick={() => download(d.id)} className="text-xs text-accent font-medium">Download</button>
                  <label className="text-xs text-gray-500 font-medium cursor-pointer">
                    Replace
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) replace(d.id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
