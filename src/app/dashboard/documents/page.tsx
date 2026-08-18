import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isS3Configured } from "@/lib/storage";
import { UNCATEGORIZED, yearLabel, workTypeLabel, monthLabel, WORK_TYPES } from "@/lib/documentOrganize";
import DocumentFileRow from "@/components/DocumentFileRow";

function folderHref(params: { year?: string; workType?: string; month?: string }) {
  const search = new URLSearchParams();
  if (params.year) search.set("year", params.year);
  if (params.workType) search.set("workType", params.workType);
  if (params.month) search.set("month", params.month);
  const qs = search.toString();
  return qs ? `/dashboard/documents?${qs}` : "/dashboard/documents";
}

export default async function DocumentsPage({ searchParams }: { searchParams: { year?: string; workType?: string; month?: string } }) {
  const session = getSession();
  const documents = await prisma.document.findMany({
    where: { firmId: session!.firmId, status: "ACTIVE" },
    // client/task links (Batch B) — both relations already existed and were
    // already populated (Client 360's own DocumentsPanel has linked both
    // since the P1 batch); this page just never selected them before.
    include: { client: { select: { id: true, name: true } }, task: { select: { id: true, title: true } } },
    orderBy: { uploadedAt: "desc" },
  });

  const year = searchParams.year;
  const workType = searchParams.workType;
  const month = searchParams.month;

  const filtered = documents.filter((d) => {
    if (year && (d.periodYear ? String(d.periodYear) : UNCATEGORIZED) !== year) return false;
    if (workType && (d.workType ?? UNCATEGORIZED) !== workType) return false;
    if (month && (d.periodMonth ? String(d.periodMonth) : UNCATEGORIZED) !== month) return false;
    return true;
  });

  const breadcrumb = (
    <div className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1">
      <Link href="/dashboard/documents" className="hover:text-accent font-medium">All Documents</Link>
      {year && <><span>/</span><Link href={folderHref({ year })} className="hover:text-accent font-medium">{yearLabel(year)}</Link></>}
      {year && workType && <><span>/</span><Link href={folderHref({ year, workType })} className="hover:text-accent font-medium">{workTypeLabel(workType)}</Link></>}
      {year && workType && month && <><span>/</span><span className="font-medium text-charcoal">{monthLabel(month)}</span></>}
    </div>
  );

  let body;
  if (!year) {
    // Level 1: Year folders
    const years = new Map<string, number>();
    for (const d of documents) {
      const key = d.periodYear ? String(d.periodYear) : UNCATEGORIZED;
      years.set(key, (years.get(key) ?? 0) + 1);
    }
    const sorted = [...years.entries()].sort((a, b) => (a[0] === UNCATEGORIZED ? 1 : b[0] === UNCATEGORIZED ? -1 : b[0].localeCompare(a[0])));
    body = <FolderGrid items={sorted.map(([key, count]) => ({ href: folderHref({ year: key }), label: yearLabel(key), count }))} empty="No documents uploaded yet." />;
  } else if (!workType) {
    // Level 2: Work type folders within the year
    const inYear = documents.filter((d) => (d.periodYear ? String(d.periodYear) : UNCATEGORIZED) === year);
    const types = new Map<string, number>();
    for (const d of inYear) {
      const key = d.workType ?? UNCATEGORIZED;
      types.set(key, (types.get(key) ?? 0) + 1);
    }
    const order = [...WORK_TYPES, UNCATEGORIZED];
    const sorted = [...types.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    body = <FolderGrid items={sorted.map(([key, count]) => ({ href: folderHref({ year, workType: key }), label: workTypeLabel(key), count }))} empty="Nothing filed under this year." />;
  } else if (!month) {
    // Level 3: Month folders within year + work type
    const inScope = documents.filter((d) => (d.periodYear ? String(d.periodYear) : UNCATEGORIZED) === year && (d.workType ?? UNCATEGORIZED) === workType);
    const months = new Map<string, number>();
    for (const d of inScope) {
      const key = d.periodMonth ? String(d.periodMonth) : UNCATEGORIZED;
      months.set(key, (months.get(key) ?? 0) + 1);
    }
    const sorted = [...months.entries()].sort((a, b) => (a[0] === UNCATEGORIZED ? 1 : b[0] === UNCATEGORIZED ? -1 : Number(a[0]) - Number(b[0])));
    body = <FolderGrid items={sorted.map(([key, count]) => ({ href: folderHref({ year, workType, month: key }), label: monthLabel(key), count }))} empty="Nothing filed under this work type." />;
  } else {
    // Leaf: file list
    body = (
      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <DocumentFileRow
                key={d.id}
                doc={{
                  id: d.id, fileName: d.fileName, category: d.category, workType: d.workType,
                  periodYear: d.periodYear, periodMonth: d.periodMonth, sizeBytes: d.sizeBytes,
                  uploadedAt: d.uploadedAt.toISOString(),
                  clientId: d.client?.id ?? null, clientName: d.client?.name ?? null,
                  task: d.task ? { id: d.task.id, title: d.task.title } : null,
                }}
              />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No files here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Documents</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isS3Configured ? "Stored in S3-compatible object storage." : "Stub mode: stored on local disk — configure S3_* in .env before deploying to production."}
        {" "}Organized by year, work type, and month. Upload documents from a client&apos;s page.
      </p>
      {breadcrumb}
      {body}
    </div>
  );
}

function FolderGrid({ items, empty }: { items: { href: string; label: string; count: number }[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 border border-line rounded-xl bg-white px-4 py-8 text-center">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="border border-line rounded-xl bg-white p-4 hover:border-accent hover:shadow-sm transition">
          <div className="text-2xl mb-2">📁</div>
          <div className="font-semibold text-sm">{item.label}</div>
          <div className="text-xs text-gray-500">{item.count} file{item.count === 1 ? "" : "s"}</div>
        </Link>
      ))}
    </div>
  );
}
