import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReconciliationSubNav from "@/components/ReconciliationSubNav";
import ReconciliationUploadForm from "@/components/ReconciliationUploadForm";

// Batch F2.4/F2.5 — the missing entry point to POST
// /api/clients/[id]/reconciliation-runs, which no UI in the app has ever
// called. Client options are firm-scoped here, server-side — the same
// client.findMany({select:{id,name}}) pattern F1 established for the
// Exceptions Queue's client filter.
export default async function ReconciliationUploadPage() {
  const session = getSession();
  const firmId = session!.firmId;
  const canManageReconciliation = session!.role !== "STAFF";

  // No point fetching the firm's client list for a form STAFF won't see —
  // this isn't a security boundary (STAFF can already see clients
  // elsewhere), just avoids an unnecessary query when the form is hidden.
  const clients = canManageReconciliation
    ? await prisma.client.findMany({ where: { firmId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Upload Reconciliation Files</h1>
      <p className="text-sm text-gray-500 mb-4">
        Upload a client&apos;s GSTR-2B/1 export or bank statement alongside their books to start a new reconciliation run.
      </p>

      <ReconciliationSubNav active="upload" canManageReconciliation={canManageReconciliation} />

      {canManageReconciliation ? (
        <ReconciliationUploadForm clients={clients} />
      ) : (
        <p className="text-xs text-gray-400">Only Partners and Managers can upload reconciliation files.</p>
      )}
    </div>
  );
}
