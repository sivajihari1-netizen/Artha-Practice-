import Link from "next/link";
import { buildPageUrl } from "@/lib/listFilters";

// Plain server-rendered links (no client JS needed for page navigation) —
// reusable as-is by the F2 run-detail page, which will paginate the same
// way against the same underlying skip/take/count shape. Deliberately just
// prev/next + a count, not a page-number strip — the audit's own guidance
// was "do not add an unnecessarily complicated pagination component."
export default function Pagination({
  pathname,
  searchParams,
  page,
  totalPages,
  total,
}: {
  pathname: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
}) {
  if (total === 0) return null;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) params.set(key, value);
  }

  return (
    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
      <span>
        Page {page} of {totalPages} · {total} result{total === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-3">
        {page > 1 ? (
          <Link href={buildPageUrl(pathname, params, page - 1)} className="font-semibold text-accent">
            ← Previous
          </Link>
        ) : (
          <span className="text-gray-300">← Previous</span>
        )}
        {page < totalPages ? (
          <Link href={buildPageUrl(pathname, params, page + 1)} className="font-semibold text-accent">
            Next →
          </Link>
        ) : (
          <span className="text-gray-300">Next →</span>
        )}
      </div>
    </div>
  );
}
