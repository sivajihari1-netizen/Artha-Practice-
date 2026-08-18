"use client";

type Doc = { id: string; fileName: string; category: string; uploadedAt: string };

export default function PortalDocumentRow({ doc }: { doc: Doc }) {
  async function download() {
    const res = await fetch(`/api/portal/documents/${doc.id}/download`);
    if (!res.ok) return;
    const data = await res.json();
    window.open(data.url, "_blank");
  }

  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3">
        <div className="font-medium">{doc.fileName}</div>
        <div className="text-xs text-gray-500">{doc.category}</div>
      </td>
      <td className="px-4 py-3 text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString("en-IN")}</td>
      <td className="px-4 py-3 text-right">
        <button onClick={download} className="text-xs text-accent font-medium">Download</button>
      </td>
    </tr>
  );
}
