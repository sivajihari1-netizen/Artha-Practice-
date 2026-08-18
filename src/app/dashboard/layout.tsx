import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/superAdmin";
import SidebarNav from "@/components/SidebarNav";
import { NAV } from "@/lib/nav";
import { visibleFor } from "@/lib/navLogic";

// The grouped, role-aware navigation (src/lib/nav.ts) is now the single,
// canonical dashboard navigation — there is no second/legacy nav and no
// opt-in toggle. (It used to be an opt-in beta behind a cookie; that toggle
// mechanism — navPreference.ts / navActions.ts / navPreferenceConstants.ts —
// has been removed entirely now that this is the only navigation, per "never
// create a second navigation architecture.")
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session) redirect("/login");

  const firm = await prisma.firm.findUnique({ where: { id: session.firmId } });
  if (!firm) redirect("/login");

  // Role filtering happens here, server-side, using session.role — the
  // client component only ever receives the categories/items this session
  // is already allowed to see (see Decision 4's comment in src/lib/nav.ts
  // for why Firm Operations itself isn't role-restricted even though most
  // of its children are). This is UX only, not a security boundary — every
  // route's own API-layer authorization is unchanged and is the real
  // enforcement point.
  const categories = visibleFor(NAV, session.role);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <SidebarNav categories={categories} firmName={firm.name} userEmail={session.email} isSuperAdmin={isSuperAdminEmail(session.email)} />
      <main className="flex-1 bg-paper min-h-screen print:bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 print:p-0 print:max-w-none">{children}</div>
      </main>
    </div>
  );
}
