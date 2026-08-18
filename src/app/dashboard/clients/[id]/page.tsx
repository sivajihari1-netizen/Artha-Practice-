import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CredentialsPanel from "@/components/CredentialsPanel";
import AddContactForm from "@/components/AddContactForm";
import AddDscForm from "@/components/AddDscForm";
import AddGstinForm from "@/components/AddGstinForm";
import RemoveGstinButton from "@/components/RemoveGstinButton";
import EditTurnoverForm from "@/components/EditTurnoverForm";
import DocumentsPanel from "@/components/DocumentsPanel";
import GstReconciliationPanel from "@/components/GstReconciliationPanel";
import DocumentRequestsPanel from "@/components/DocumentRequestsPanel";
import InvoicesPanel from "@/components/InvoicesPanel";
import QuotationsPanel from "@/components/QuotationsPanel";
import ReconciliationPanel from "@/components/ReconciliationPanel";
import LeadOriginPanel from "@/components/LeadOriginPanel";
import NotificationHistoryPanel from "@/components/NotificationHistoryPanel";
import ActivityTimeline from "@/components/ActivityTimeline";
import Breadcrumb from "@/components/Breadcrumb";
import ClientArchiveControl from "@/components/ClientArchiveControl";
import { getApplicableRuleInstances } from "@/lib/complianceRules";
import { getClientUnifiedActivityTimeline } from "@/lib/activity";
import { formatDocRequestSummary, taskHref } from "@/lib/taskBoard";

const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "text-gray-500 bg-gray-100",
  MEDIUM: "text-blue-700 bg-blue-50",
  HIGH: "text-amber-700 bg-amber-50",
  URGENT: "text-red-700 bg-red-50",
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  const client = await prisma.client.findFirst({
    where: { id: params.id, firmId: session!.firmId },
    include: {
      contacts: true,
      credentials: { select: { id: true, label: true, username: true, expiresAt: true } },
      dscRecords: true,
      // _count.documents powers the lightweight "N docs" hint in the flat
      // Tasks list below — there's no Task detail page to link to yet, so
      // this is the smallest useful surface for Task -> Document. documentRequests
      // (P1 batch) powers the same list's "N/M docs received" indicator —
      // informational only, never changes Task.status.
      tasks: {
        orderBy: { dueDate: "asc" },
        include: { _count: { select: { documents: true } }, documentRequests: { select: { items: { select: { fulfilled: true } } } } },
      },
      documents: { where: { status: "ACTIVE" }, orderBy: { uploadedAt: "desc" } },
      gstReconciliations: {
        orderBy: { createdAt: "desc" },
        select: { id: true, period: true, createdAt: true, matchedCount: true, onlyIn2bCount: true, onlyInBooksCount: true, mismatchCount: true },
      },
      documentRequests: { orderBy: { createdAt: "desc" }, include: { items: true } },
      gstins: { orderBy: { createdAt: "desc" } },
      // P0.1 / P0.2 / P0.3 — Invoice/Quotation/ReconciliationRun already
      // carry clientId; this only surfaces what's already there, no new
      // relation, no duplicated data. Bundled into the same findFirst as
      // everything else on this page, so no extra round-trip (no N+1).
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, invoiceNumber: true, status: true, issueDate: true, dueDate: true, total: true },
      },
      quotations: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, quotationNumber: true, title: true, serviceType: true, status: true, issueDate: true },
      },
      reconciliationRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true, type: true, status: true, periodStart: true, periodEnd: true,
          matchedCount: true, exceptionCount: true,
          // Live unresolved count, not the static exceptionCount snapshot —
          // exceptionCount is set once when matching completes and is never
          // decremented as exceptions get resolved/ignored, so it alone
          // would go stale the moment someone clears the first one.
          _count: { select: { matches: { where: { status: "EXCEPTION" } } } },
        },
      },
      _count: { select: { invoices: true, quotations: true, reconciliationRuns: true } },
      // Lead origin (Phase 1) — Client.convertedFromLeads already exists
      // specifically for this; a client converts from at most one Lead in
      // practice, but the relation is a list, so render whatever's there.
      convertedFromLeads: {
        select: { id: true, name: true, stage: true, createdAt: true, updatedAt: true },
      },
      // Notification history (Phase 1) — deliberately NOT selecting payload
      // or error: payload holds the full email/WhatsApp body (including
      // live reset/magic-link tokens for auth-related sends), and error can
      // contain raw SMTP/WhatsApp-provider diagnostic text. Neither belongs
      // on a page any Partner/Manager/Staff with client access can view.
      notificationLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, channel: true, toAddress: true, template: true, status: true, createdAt: true, sentAt: true },
      },
    },
  });
  if (!client) notFound();

  const canReveal = session!.role !== "STAFF";
  // Archive/reactivate (Batch C) — a UI-only convention, not a new backend
  // rule: DELETE/PATCH /api/clients/[id] have no role check today (any
  // authenticated firm member can already call them). Restricting the
  // button to non-STAFF matches how every other "manage this record"
  // action in the app is gated, without changing what the API itself allows.
  const canManageClient = session!.role !== "STAFF";

  const activeGstins = client.gstins.filter((g) => g.active);
  const rules = await prisma.complianceRule.findMany({ where: { active: true } });
  const applicableRules = getApplicableRuleInstances(rules, client, activeGstins);

  // Client 360 Phase 1 (Unified Activity Feed) — merges CLIENT activity with
  // that client's own Invoice/Quotation activity so "what happened with
  // this client recently" actually includes billing events. Always an
  // initial load only (nextCursor is always null) — see the function's own
  // doc comment for why cross-entity "Load more" is a deferred Phase 2.
  const timeline = await getClientUnifiedActivityTimeline({ firmId: session!.firmId, clientId: client.id });

  return (
    <div>
      <Breadcrumb items={[{ label: "Clients", href: "/dashboard/clients" }, { label: client.name }]} />
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-extrabold">{client.name}</h1>
        {canManageClient && <ClientArchiveControl clientId={client.id} active={client.active} />}
      </div>
      <p className="text-sm text-gray-500 mb-2">
        {client.type} {client.pan ? `· PAN ${client.pan}` : ""} {client.gstin ? `· GSTIN ${client.gstin}` : ""}
      </p>
      <div className="mb-6">
        <EditTurnoverForm clientId={client.id} turnover={client.turnover} />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="border border-line rounded-xl bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Contact Persons</h3>
            <AddContactForm clientId={client.id} />
          </div>
          {client.contacts.length === 0 ? (
            <p className="text-xs text-gray-400">No contacts added yet.</p>
          ) : (
            <ul className="space-y-2">
              {client.contacts.map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="font-medium">
                    {c.name} {c.isPrimary && <span className="text-xs text-accent">(Primary)</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.designation ?? ""} {c.phone ? `· ${c.phone}` : ""} {c.email ? `· ${c.email}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {client.contacts.some((c) => c.email) && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-line">
              Contacts with an email on file can log into the{" "}
              <span className="font-medium text-charcoal">Client Portal</span> at{" "}
              <span className="font-mono">{(process.env.APP_URL ?? "https://arthapractice.in").replace(/^https?:\/\//, "")}/portal/login</span>{" "}
              to check compliance status and their documents.
            </p>
          )}
        </div>

        <LeadOriginPanel leads={client.convertedFromLeads} />

        <CredentialsPanel clientId={client.id} credentials={client.credentials as any} canReveal={canReveal} />

        <div className="border border-line rounded-xl bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">DSC Records</h3>
            <AddDscForm clientId={client.id} />
          </div>
          {client.dscRecords.length === 0 ? (
            <p className="text-xs text-gray-400">No DSC records tracked yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {client.dscRecords.map((d) => (
                <li key={d.id}>
                  <span className="font-medium">{d.holderName}</span>{" "}
                  <span className="text-xs text-gray-500">expires {new Date(d.expiresAt).toLocaleDateString("en-IN")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-line rounded-xl bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">GST Registrations</h3>
            <AddGstinForm clientId={client.id} />
          </div>
          {activeGstins.length === 0 ? (
            <p className="text-xs text-gray-400">No GSTINs added yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activeGstins.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium font-mono">{g.gstin}</span>{" "}
                    <span className="text-xs text-gray-500">
                      · {g.state} {g.qrmpOpted && <span className="text-accent">· QRMP</span>}
                    </span>
                  </div>
                  <RemoveGstinButton clientId={client.id} gstinId={g.id} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-line rounded-xl bg-white p-5">
          <h3 className="font-bold text-sm mb-1">Applicable Compliance Filings</h3>
          <p className="text-xs text-gray-400 mb-3">Auto-detected from entity type, GSTINs and QRMP status.</p>
          {applicableRules.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing detected yet — add a GSTIN or check entity type.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {applicableRules.map(({ rule, clientGstin }, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span className="font-medium">{rule.title}</span>
                  <span className="text-gray-500">{clientGstin ? clientGstin.gstin : rule.recurrence}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-line rounded-xl bg-white p-5">
          <h3 className="font-bold text-sm mb-3">Tasks</h3>
          {client.tasks.length === 0 ? (
            <p className="text-xs text-gray-400">No tasks for this client yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {client.tasks.map((t) => {
                const allItems = t.documentRequests.flatMap((r) => r.items);
                const docSummary = formatDocRequestSummary(
                  allItems.length > 0 ? { total: allItems.length, fulfilled: allItems.filter((i) => i.fulfilled).length } : null
                );
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Link href={taskHref(t.id)} className="font-medium hover:text-accent hover:underline">
                        {t.title}
                      </Link>
                      {t._count.documents > 0 && (
                        <span className="text-gray-400"> · {t._count.documents} doc{t._count.documents === 1 ? "" : "s"}</span>
                      )}
                      {docSummary && (
                        <span className={docSummary.outstanding > 0 ? "text-amber-600" : "text-green-700"}> · {docSummary.label}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {t.priority && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                      )}
                      <span className="text-xs text-gray-500">{t.status}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DocumentsPanel
          clientId={client.id}
          documents={client.documents as any}
          tasks={client.tasks.map((t) => ({ id: t.id, title: t.title }))}
        />

        <GstReconciliationPanel clientId={client.id} reconciliations={client.gstReconciliations as any} />

        <ReconciliationPanel
          latestRun={
            client.reconciliationRuns[0]
              ? {
                  id: client.reconciliationRuns[0].id,
                  type: client.reconciliationRuns[0].type,
                  status: client.reconciliationRuns[0].status,
                  periodStart: client.reconciliationRuns[0].periodStart,
                  periodEnd: client.reconciliationRuns[0].periodEnd,
                  matchedCount: client.reconciliationRuns[0].matchedCount,
                  exceptionCount: client.reconciliationRuns[0].exceptionCount,
                  unresolvedCount: client.reconciliationRuns[0]._count.matches,
                }
              : null
          }
          totalRunCount={client._count.reconciliationRuns}
        />

        <DocumentRequestsPanel
          clientId={client.id}
          requests={client.documentRequests as any}
          tasks={client.tasks.map((t) => ({ id: t.id, title: t.title }))}
        />

        <InvoicesPanel invoices={client.invoices} totalCount={client._count.invoices} />

        <QuotationsPanel quotations={client.quotations} totalCount={client._count.quotations} />

        <NotificationHistoryPanel logs={client.notificationLogs} />

        <div className="border border-line rounded-xl bg-white p-5">
          <h3 className="font-bold text-sm mb-3">Activity</h3>
          <ActivityTimeline
            entityType="CLIENT"
            entityId={client.id}
            initialActivities={timeline.ok ? (timeline.activities as any) : []}
            initialNextCursor={timeline.ok ? timeline.nextCursor : null}
          />
        </div>
      </div>
    </div>
  );
}
