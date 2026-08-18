"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = {
  id: string;
  name: string;
  key: string;
  systemKey: string | null;
  description: string | null;
  sortOrder: number;
  color: string | null;
  isActive: boolean;
  isDefault: boolean;
};

export default function TaskWorkflowSettingsPanel({
  statusOptions,
  categoryOptions,
  canEdit,
}: {
  statusOptions: Option[];
  categoryOptions: Option[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState(statusOptions);
  const [categoryDraft, setCategoryDraft] = useState(categoryOptions);
  const [tab, setTab] = useState<"status" | "category">("status");

  // Rows added via "+ Add status/category" get a client-only placeholder id
  // (never sent as a real id) so the row is addressable in the draft array
  // before it has been saved. Save turns these into a create; Remove on an
  // unsaved row just drops it locally with no network call.
  const isUnsaved = (id: string) => id.startsWith("new:");
  const newId = () => `new:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/task-workflow", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statuses: statusDraft.map(({ id, name, key, description, sortOrder, color, isActive, isDefault }) => ({
          id: isUnsaved(id) ? undefined : id, name, key, description, sortOrder, color, isActive, isDefault,
        })),
        categories: categoryDraft.map(({ id, name, key, description, sortOrder, color, isActive, isDefault }) => ({
          id: isUnsaved(id) ? undefined : id, name, key, description, sortOrder, color, isActive, isDefault,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  };

  const updateStatus = (id: string, patch: Partial<Option>) => {
    setStatusDraft((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateCategory = (id: string, patch: Partial<Option>) => {
    setCategoryDraft((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addStatus = () => {
    setStatusDraft((prev) => [
      ...prev,
      { id: newId(), name: "", key: "", systemKey: null, description: null, sortOrder: prev.length + 1, color: "#94A3B8", isActive: true, isDefault: false },
    ]);
  };

  const addCategory = () => {
    setCategoryDraft((prev) => [
      ...prev,
      { id: newId(), name: "", key: "", systemKey: null, description: null, sortOrder: prev.length + 1, color: "#94A3B8", isActive: true, isDefault: false },
    ]);
  };

  const removeStatus = async (option: Option) => {
    if (isUnsaved(option.id)) {
      setStatusDraft((prev) => prev.filter((item) => item.id !== option.id));
      return;
    }
    if (!confirm(`Delete status "${option.name}"? This can't be undone. Tasks still using it will block the deletion.`)) return;
    setError(null);
    const res = await fetch(`/api/task-workflow?type=status&id=${option.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setStatusDraft((prev) => prev.filter((item) => item.id !== option.id));
    router.refresh();
  };

  const removeCategory = async (option: Option) => {
    if (isUnsaved(option.id)) {
      setCategoryDraft((prev) => prev.filter((item) => item.id !== option.id));
      return;
    }
    if (!confirm(`Delete category "${option.name}"? This can't be undone. Tasks still using it will block the deletion.`)) return;
    setError(null);
    const res = await fetch(`/api/task-workflow?type=category&id=${option.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    setCategoryDraft((prev) => prev.filter((item) => item.id !== option.id));
    router.refresh();
  };

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold">Task workflow</h2>
          <p className="text-xs text-gray-500">Customize the labels and order used in the task board and task creation forms.</p>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving} className="bg-accent text-white rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>

      {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("status")} className={`px-3 py-1.5 rounded-md text-sm ${tab === "status" ? "bg-accent text-white" : "bg-paper-dim text-gray-600"}`}>
            Statuses
          </button>
          <button type="button" onClick={() => setTab("category")} className={`px-3 py-1.5 rounded-md text-sm ${tab === "category" ? "bg-accent text-white" : "bg-paper-dim text-gray-600"}`}>
            Categories
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={tab === "status" ? addStatus : addCategory}
            className="text-xs font-semibold text-accent border border-accent rounded-md px-3 py-1.5"
          >
            {tab === "status" ? "+ Add status" : "+ Add category"}
          </button>
        )}
      </div>

      {tab === "status" ? (
        <div className="space-y-3">
          {statusDraft.map((option) => (
            <div key={option.id} className="grid grid-cols-[1fr_1.2fr_90px_80px_60px] gap-2 items-center border border-line rounded-lg p-2">
              <input
                disabled={!canEdit}
                placeholder={isUnsaved(option.id) ? "Name" : undefined}
                value={option.name}
                onChange={(e) => updateStatus(option.id, { name: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm disabled:bg-paper-dim"
              />
              <input
                disabled={!canEdit}
                placeholder={isUnsaved(option.id) ? "key" : undefined}
                value={option.key}
                onChange={(e) => updateStatus(option.id, { key: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm disabled:bg-paper-dim"
              />
              <input
                disabled={!canEdit}
                type="color"
                value={option.color ?? "#94A3B8"}
                onChange={(e) => updateStatus(option.id, { color: e.target.value })}
                className="w-full h-9 border border-line rounded-md p-0.5 disabled:opacity-60"
              />
              <label className="flex items-center justify-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={option.isActive}
                  onChange={(e) => updateStatus(option.id, { isActive: e.target.checked })}
                />
                Active
              </label>
              {canEdit && !option.isDefault && (
                <button type="button" onClick={() => removeStatus(option)} className="text-xs text-gray-400 hover:text-red-600">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {categoryDraft.map((option) => (
            <div key={option.id} className="grid grid-cols-[1fr_1.2fr_90px_80px_60px] gap-2 items-center border border-line rounded-lg p-2">
              <input
                disabled={!canEdit}
                placeholder={isUnsaved(option.id) ? "Name" : undefined}
                value={option.name}
                onChange={(e) => updateCategory(option.id, { name: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm disabled:bg-paper-dim"
              />
              <input
                disabled={!canEdit}
                placeholder={isUnsaved(option.id) ? "key" : undefined}
                value={option.key}
                onChange={(e) => updateCategory(option.id, { key: e.target.value })}
                className="border border-line rounded-md px-2 py-1.5 text-sm disabled:bg-paper-dim"
              />
              <input
                disabled={!canEdit}
                type="color"
                value={option.color ?? "#94A3B8"}
                onChange={(e) => updateCategory(option.id, { color: e.target.value })}
                className="w-full h-9 border border-line rounded-md p-0.5 disabled:opacity-60"
              />
              <label className="flex items-center justify-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={option.isActive}
                  onChange={(e) => updateCategory(option.id, { isActive: e.target.checked })}
                />
                Active
              </label>
              {canEdit && !option.isDefault && (
                <button type="button" onClick={() => removeCategory(option)} className="text-xs text-gray-400 hover:text-red-600">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!canEdit && <p className="text-xs text-gray-400 mt-4">Only Partners and Managers can edit the workflow configuration.</p>}
    </div>
  );
}
