import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActivePortalClient } from "@/lib/clientPortalAccess";
import { UNCATEGORIZED, yearLabel, workTypeLabel, monthLabel, WORK_TYPES } from "@/lib/documentOrganize";
import PortalDocumentRow from "@/components/PortalDocumentRow";

function folderHref(params: { year?: string; workType?: string; month?: string }) {
  const search = new URLSearchParams();
  if (params.year) search.set("year", params.year);
  if (params.workType) search.set("workType", params.workType);
  if (params.month) search.set("month", params.month);
  const qs = search.toString();
  return qs ? `/portal/documents?${qs}` : "/portal/documents";
}

export default async function PortalDocumentsPage({ searchParams }: { searchParams: { year?: string; workType?: string; month?: string } }) {
  const client = await getActivePortalClient();
  if (!client) redirect("/portal/login");

  const documents = await prisma.document.findMany({
    where: { clientId: client.id, status: "ACTIVE" },
    orderBy: { uploadedAt: "desc" },
  });

  const { year, workType, month } = searchParams;

  const filtered = documents.filter((d) => {
    if (year && (d.periodYear ? String(d.periodYear) : UNCATEGORIZED) !== year) return false;
    if (workType && (d.workType ?? UNCATEGORIZED) !== workType) return false;
    if (month && (d.periodMonth ? String(d.periodMonth) : UNCATEGORIZED) !== month) return false;
    return true;
  });

  const breadcrumb = (
    <div className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1">
      <Link href="/portal/documents" className="hover:text-accent font-medium">All Documents</Link>
      {year && <><span>/</span><Link href={folderHref({ year })} className="hover:text-accent font-medium">{yearLabel(year)}</Link></>}
      {year && workType && <><span>/</span><Link href={folderHref({ year, workType })} className="hover:text-accent font-medium">{workTypeLabel(workType)}</Link></>}
      {year && workType && month && <><span>/</span><span className="font-medium text-charcoal">{monthLabel(month)}</span></>}
    </div>
  );

  let body;
  if (!year) {
    const years = new Map<string, number>();
    for (const d of documents) {
      const key = d.periodYear ? String(d.periodYear) : UNCATEGORIZED;
      years.set(key, (years.get(key) ?? 0) + 1);
    }
    const sorted = [...years.entries()].sort((a, b) => (a[0] === UNCATEGORIZED ? 1 : b[0] === UNCATEGORIZED ? -1 : b[0].localeCompare(a[0])));
    body = <FolderGrid items={sorted.map(([key, count]) => ({ href: folderHref({ year: key }), label: yearLabel(key), count }))} empty="No documents on file yet." />;
  } else if (!workType) {
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
    const inScope = documents.filter((d) => (d.periodYear ? String(d.periodYear) : UNCATEGORIZED) === year && (d.workType ?? UNCATEGORIZED) === workType);
    const months = new Map<string, number>();
    for (const d of inScope) {
      const key = d.periodMonth ? String(d.periodMonth) : UNCATEGORIZED;
      months.set(key, (months.get(key) ?? 0) + 1);
    }
    const sorted = [...months.entries()].sort((a, b) => (a[0] === UNCATEGORIZED ? 1 : b[0] === UNCATEGORIZED ? -1 : Number(a[0]) - Number(b[0])));
    body = <FolderGrid items={sorted.map(([key, count]) => ({ href: folderHref({ year, workType, month: key }), label: monthLabel(key), count }))} empty="Nothing filed under this work type." />;
  } else {
    body = (
      <div className="border border-line rounded-xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-dim text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <PortalDocumentRow key={d.id} doc={{ id: d.id, fileName: d.fileName, category: d.category, uploadedAt: d.uploadedAt.toISOString() }} />
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No files here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">Documents</h1>
      <p className="text-sm text-gray-500 mb-6">Organized by year, work type, and month.</p>
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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
