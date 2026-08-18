type OriginLead = {
  id: string;
  name: string;
  stage: "NEW" | "CONTACTED" | "PROPOSAL_SENT" | "WON" | "LOST";
  createdAt: Date | string;
  /** Touched exactly at conversion time by the Lead PATCH route — the closest real signal to "converted at" without a dedicated column. */
  updatedAt: Date | string;
};

/**
 * There is no Lead detail page in the app today, so this deliberately does
 * not render a link — a link to a page that doesn't exist would be worse
 * than no link. If one is ever built, this is the one place to add it.
 */
export default function LeadOriginPanel({ leads }: { leads: OriginLead[] }) {
  if (leads.length === 0) return null; // most clients don't originate from a Lead — nothing to show, no empty-state noise

  return (
    <div className="border border-line rounded-xl bg-white p-5">
      <h3 className="font-bold text-sm mb-3">Lead Origin</h3>
      <ul className="space-y-2">
        {leads.map((lead) => (
          <li key={lead.id} className="text-sm">
            <div className="font-medium">{lead.name}</div>
            <div className="text-xs text-gray-500">
              Stage at conversion: {lead.stage} · Lead created {new Date(lead.createdAt).toLocaleDateString("en-IN")} · Converted{" "}
              {new Date(lead.updatedAt).toLocaleDateString("en-IN")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
