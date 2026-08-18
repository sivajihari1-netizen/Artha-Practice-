type Row = { userId: string; name: string; open: number; overdue: number; dueSoon: number };

/** Simple, absolute thresholds — good enough to answer "who's overloaded" without inventing a scoring model. */
function loadColor(open: number): string {
  if (open > 10) return "text-red-700 bg-red-50";
  if (open > 5) return "text-amber-700 bg-amber-50";
  return "text-green-700 bg-green-50";
}
function loadLabel(open: number): string {
  if (open > 10) return "Heavy";
  if (open > 5) return "Moderate";
  return "Light";
}

/**
 * Partner/Manager only (gated by the caller, matching the app's existing
 * pattern for oversight panels). Purely a read of existing data — reuses
 * getStaffLoadForFirm for the "open" figure, nothing here writes anything.
 */
export default function StaffWorkloadPanel({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="border border-line rounded-xl bg-white overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-line font-bold text-sm">Workload</div>
      <table className="w-full text-sm">
        <thead className="bg-paper-dim text-left text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Staff member</th>
            <th className="px-4 py-3 font-medium">Open tasks</th>
            <th className="px-4 py-3 font-medium">Overdue</th>
            <th className="px-4 py-3 font-medium">Due soon</th>
            <th className="px-4 py-3 font-medium">Load</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].sort((a, b) => b.open - a.open).map((r) => (
            <tr key={r.userId} className="border-t border-line">
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3 text-gray-500">{r.open}</td>
              <td className="px-4 py-3">
                {r.overdue > 0 ? <span className="text-red-600 font-semibold">{r.overdue}</span> : <span className="text-gray-400">0</span>}
              </td>
              <td className="px-4 py-3 text-gray-500">{r.dueSoon}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${loadColor(r.open)}`}>{loadLabel(r.open)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
