import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AddClientForm from "@/components/AddClientForm";

export default async function ClientsPage({ searchParams }: { searchParams: { status?: string } }) {
  const session = getSession();
  // Archived view (Batch C) — the archive action lives on Client 360; this
  // is just the other half of "don't let an archived client accidentally
  // disappear from where it's still needed for historical records." Default
  // (no param) is unchanged from before: active clients only.
  const showArchived = searchParams.status === "archived";
  const clients = await prisma.client.findMany({
    where: { firmId: session!.firmId, active: !showArchived },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true, documents: { where: { status: "ACTIVE" } } } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold mb-1">Clients</h1>
          <p className="text-sm text-gray-500">
            {clients.length} {showArchived ? "archived client" : "active client"}{clients.length === 1 ? "" : "s"} ·{" "}
            <Link href={showArchived ? "/dashboard/clients" : "/dashboard/clients?status=archived"} className="text-accent font-medium">
              {showArchived ? "View active clients" : "View archived clients"}
            </Link>
          </p>
        </div>
        <AddClientForm />
      </div>

      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">PAN</th>
              <th className="px-4 py-3 font-medium">GSTIN</th>
              <th className="px-4 py-3 font-medium">Tasks</th>
              <th className="px-4 py-3 font-medium">Documents</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-line hover:bg-paper-dim/50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/clients/${c.id}`} className="font-medium text-accent">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.type}</td>
                <td className="px-4 py-3 text-gray-500">{c.pan ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{c.gstin ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{c._count.tasks}</td>
                <td className="px-4 py-3 text-gray-500">{c._count.documents}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {showArchived ? "No archived clients." : "No clients yet — add your first one above."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
