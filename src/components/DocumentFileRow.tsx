"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DocumentReclassifyForm from "@/components/DocumentReclassifyForm";
import { taskHref } from "@/lib/taskBoard";

type Doc = {
  id: string;
  fileName: string;
  category: string;
  workType: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  sizeBytes: number | null;
  uploadedAt: string;
  clientId: string | null;
  clientName: string | null;
  task: { id: string; title: string } | null;
};

export default function DocumentFileRow({ doc }: { doc: Doc }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function download() {
    const res = await fetch(`/api/documents/${doc.id}/download`);
    if (!res.ok) return;
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  async function replace(newFile: File) {
    const formData = new FormData();
    formData.append("file", newFile);
    const res = await fetch(`/api/documents/${doc.id}/replace`, { method: "POST", body: formData });
    if (res.ok) router.refresh();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Replace failed");
    }
  }

  async function remove() {
    if (!confirm("Delete this document? It can still be recovered from the audit log if needed.")) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-3" colSpan={editing ? 5 : 1}>
        <div className="font-medium">{doc.fileName}</div>
        <div className="text-xs text-gray-500">{doc.category}</div>
        {doc.task && (
          <div className="text-xs text-gray-500">
            Linked to:{" "}
            <Link href={taskHref(doc.task.id)} className="text-accent hover:underline">
              {doc.task.title}
            </Link>
          </div>
        )}
        {editing && <DocumentReclassifyForm doc={doc} onDone={() => setEditing(false)} />}
      </td>
      {!editing && (
        <>
          <td className="px-4 py-3 text-gray-500">
            {doc.clientId ? (
              <Link href={`/dashboard/clients/${doc.clientId}`} className="text-accent hover:underline">
                {doc.clientName}
              </Link>
            ) : (
              doc.clientName ?? "—"
            )}
          </td>
          <td className="px-4 py-3 text-gray-500">{doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : "—"}</td>
          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</td>
          <td className="px-4 py-3 text-right whitespace-nowrap">
            <button onClick={() => setEditing(true)} className="text-xs text-gray-500 font-medium mr-3">Reclassify</button>
            <button onClick={download} className="text-xs text-accent font-medium mr-3">Download</button>
            <label className="text-xs text-gray-500 font-medium mr-3 cursor-pointer">
              Replace
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) replace(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button onClick={remove} className="text-xs text-gray-400 hover:text-red-600 font-medium">Delete</button>
          </td>
        </>
      )}
    </tr>
  );
}
