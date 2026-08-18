import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getPortalSession } from "@/lib/clientPortalAuth";
import { getAccessibleClients, resolveActiveClient, PORTAL_ACTIVE_CLIENT_COOKIE } from "@/lib/clientPortalAccess";
import PortalLogoutButton from "@/components/PortalLogoutButton";
import PortalClientSwitcher from "@/components/PortalClientSwitcher";

export default async function PortalAuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = getPortalSession();
  if (!session) redirect("/portal/login");

  const accessible = await getAccessibleClients(session.email);
  if (accessible.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-paper">
        <div className="max-w-sm text-center">
          <p className="text-sm text-gray-500">
            We couldn&apos;t find any client records linked to <strong>{session.email}</strong>. If you believe this is
            an error, please contact your CA firm.
          </p>
          <PortalLogoutButton className="mt-4 text-xs text-accent font-medium" />
        </div>
      </div>
    );
  }

  const preferredId = cookies().get(PORTAL_ACTIVE_CLIENT_COOKIE)?.value;
  const active = resolveActiveClient(accessible, preferredId)!;

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-white border-b border-line">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold">
              Artha<span className="text-accent">.</span>
              <span className="text-xs font-normal text-gray-500 ml-2">Client Portal</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{active.name} · {active.firmName}</div>
          </div>
          <div className="flex items-center gap-4">
            {accessible.length > 1 && (
              <PortalClientSwitcher clients={accessible.map((c) => ({ id: c.id, name: c.name }))} activeId={active.id} />
            )}
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link href="/portal" className="hover:text-accent">Status</Link>
              <Link href="/portal/documents" className="hover:text-accent">Documents</Link>
              <Link href="/portal/invoices" className="hover:text-accent">Invoices</Link>
            </nav>
            <PortalLogoutButton className="text-xs text-gray-500 hover:text-accent" />
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
