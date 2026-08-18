"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string; fulfilled: boolean };
type RequestInfo = {
  firmName: string;
  clientName: string;
  note: string | null;
  status: string;
  items: Item[];
};

export default function UploadPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/upload/${params.token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "This link isn't valid.");
        }
        return res.json();
      })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [params.token]);

  async function upload(itemId: string, file: File) {
    setUploadingId(itemId);
    setError(null);
    const formData = new FormData();
    formData.append("itemId", itemId);
    formData.append("file", file);
    const res = await fetch(`/api/upload/${params.token}`, { method: "POST", body: formData });
    setUploadingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed");
      return;
    }
    setInfo((prev) => (prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, fulfilled: true } : i)) } : prev));
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-line rounded-xl p-8 bg-white">
        <div className="text-2xl font-extrabold mb-1">
          Artha<span className="text-accent">.</span>
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        {!info && !error && <p className="text-sm text-gray-500 mt-4">Loading…</p>}

        {info && (
          <>
            <p className="text-sm text-gray-500 mt-2 mb-1">
              <span className="font-medium text-charcoal">{info.firmName}</span> requested the following documents
              from <span className="font-medium text-charcoal">{info.clientName}</span>.
            </p>
            {info.note && <p className="text-xs text-gray-500 mb-4">{info.note}</p>}

            <ul className="space-y-3 mt-4">
              {info.items.map((item) => (
                <li key={item.id} className="border border-line rounded-md p-3 flex items-center justify-between gap-3">
                  <span className="text-sm">{item.label}</span>
                  {item.fulfilled ? (
                    <span className="text-xs font-semibold text-accent">✓ Uploaded</span>
                  ) : (
                    <label className="text-xs font-semibold text-accent cursor-pointer">
                      {uploadingId === item.id ? "Uploading…" : "Upload"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingId !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) upload(item.id, file);
                        }}
                      />
                    </label>
                  )}
                </li>
              ))}
            </ul>

            {info.items.every((i) => i.fulfilled) && (
              <p className="text-sm text-accent font-medium mt-4">All documents received — thank you!</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
