"use client";

export default function PortalClientSwitcher({ clients, activeId }: { clients: { id: string; name: string }[]; activeId: string }) {
  return (
    <form action="/api/portal/select-client" method="POST" className="flex items-center gap-1.5">
      <select
        name="clientId"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="border border-line rounded-md px-2 py-1 text-xs"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <noscript><button type="submit" className="text-xs border border-line rounded-md px-2 py-1">Switch</button></noscript>
    </form>
  );
}
