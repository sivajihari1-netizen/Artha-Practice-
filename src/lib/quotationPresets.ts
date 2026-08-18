export const QUOTATION_SERVICE_TYPES = ["INCORPORATION", "VIRTUAL_CFO", "GST", "AUDIT", "TDS", "OTHER"] as const;
export type QuotationServiceType = (typeof QUOTATION_SERVICE_TYPES)[number];

export const QUOTATION_SERVICE_TYPE_LABELS: Record<QuotationServiceType, string> = {
  INCORPORATION: "Company Incorporation",
  VIRTUAL_CFO: "Virtual CFO & Compliance Support",
  GST: "GST Registration & Filing",
  AUDIT: "Statutory Audit",
  TDS: "TDS Compliance",
  OTHER: "Custom Proposal",
};

export type ScopeItem = { title: string; description: string };
export type FeeItem = { particulars: string; fee: number; frequency: string };
export type TermItem = { label: string; description: string };
export type StatHighlight = { label: string; value: string };

export type QuotationPreset = {
  title: string;
  subtitle: string;
  statHighlights: StatHighlight[];
  aboutPoints: ScopeItem[]; // { title, description } — same shape as a scope item
  scopeItems: ScopeItem[];
  feeItems: FeeItem[];
  termsItems: TermItem[];
};

// Generic, reusable CA engagement terms — the same boilerplate applies
// regardless of service type. Firms can still edit any line after picking a preset.
const DEFAULT_TERMS: TermItem[] = [
  { label: "Services", description: "Performed with reasonable skill and care, solely for the purpose stated in the scope of this proposal." },
  { label: "Liability", description: "Limited to the Client alone. No third-party liability unless agreed in writing." },
  { label: "Confidentiality", description: "Both parties keep all confidential information strictly private, except as required by law." },
  { label: "Client Responsibilities", description: "Timely provision of financial data and system access is the Client's responsibility. Delays may affect deliverable timelines." },
  { label: "Engagement Term & Termination", description: "Either party may terminate with 30 days' written notice after the minimum engagement term." },
  { label: "Fee Revision", description: "Fees may be reviewed annually or upon material change in scope, with prior written communication." },
  { label: "ICAI Code", description: "This proposal introduces our services only and is not a solicitation contrary to ICAI regulations." },
];

const DEFAULT_ABOUT_POINTS: ScopeItem[] = [
  { title: "Dedicated Expert Oversight", description: "Senior review of every decision, not just a compliance rubber-stamp." },
  { title: "Faster Turnaround", description: "Queries answered within 24 hours. Strict internal timelines." },
  { title: "Always Audit-Ready", description: "Investor and due-diligence ready — not reactive." },
  { title: "One Team, One Point of Contact", description: "Everything fully coordinated under a single relationship." },
];

// Values are left blank deliberately — a fake "X+" placeholder would print
// straight into the PDF if the firm forgot to edit it. Cards render only
// once a real value is filled in (see QuotationDocument.tsx / quotationPdf.ts).
const DEFAULT_STATS: StatHighlight[] = [
  { label: "Years of Experience", value: "" },
  { label: "Clients Served", value: "" },
  { label: "Services In-House", value: "" },
  { label: "Point of Contact", value: "1" },
];

const PRESETS: Record<QuotationServiceType, QuotationPreset> = {
  INCORPORATION: {
    title: "Company Incorporation Services",
    subtitle: "Professional Services Proposal",
    statHighlights: DEFAULT_STATS,
    aboutPoints: DEFAULT_ABOUT_POINTS,
    scopeItems: [
      { title: "Name Approval & Digital Signatures", description: "RUN/SPICe+ Part A name approval, DSC and DIN application for all proposed directors." },
      { title: "Drafting & ROC Filing", description: "MOA/AOA drafting, SPICe+ Part B filing, and coordination with the Registrar of Companies until Certificate of Incorporation is issued." },
      { title: "PAN, TAN & Bank Account", description: "Application for company PAN/TAN and assistance opening the current bank account." },
      { title: "Post-Incorporation Compliance Kickoff", description: "First board resolutions, statutory registers, and a compliance calendar for the first year." },
    ],
    feeItems: [
      { particulars: "Government & Professional Fees — Incorporation", fee: 15000, frequency: "One-time" },
      { particulars: "PAN, TAN & Bank Account Assistance", fee: 3000, frequency: "One-time" },
    ],
    termsItems: DEFAULT_TERMS,
  },
  VIRTUAL_CFO: {
    title: "Virtual CFO & Compliance Support Services",
    subtitle: "Professional Services Proposal",
    statHighlights: DEFAULT_STATS,
    aboutPoints: DEFAULT_ABOUT_POINTS,
    scopeItems: [
      { title: "Accounting & Financial Management", description: "Monthly bookkeeping, entry review, receivables/payables and cash flow tracking, MIS reporting, and process controls." },
      { title: "Statutory & Compliance Support", description: "Monthly GST and TDS compliance support, PF, ESI, PT, ROC and other regulatory filings, coordinated with your internal teams and consultants." },
      { title: "Strategic CFO Advisory", description: "Ongoing financial advisory, budgeting, and periodic strategy discussions with management." },
    ],
    feeItems: [
      { particulars: "Virtual CFO Services — Accounting, Statutory Compliance Support, Investor Readiness", fee: 30000, frequency: "Monthly" },
    ],
    termsItems: DEFAULT_TERMS,
  },
  GST: {
    title: "GST Registration & Compliance Services",
    subtitle: "Professional Services Proposal",
    statHighlights: DEFAULT_STATS,
    aboutPoints: DEFAULT_ABOUT_POINTS,
    scopeItems: [
      { title: "GST Registration", description: "End-to-end GSTIN application and documentation." },
      { title: "Monthly Return Filing", description: "GSTR-1 and GSTR-3B preparation and filing every month, within due dates." },
      { title: "Reconciliation", description: "GSTR-2B vs. purchase register reconciliation to flag mismatches before they become notices." },
      { title: "Annual Return", description: "GSTR-9/9C preparation and filing at year-end." },
    ],
    feeItems: [
      { particulars: "GST Registration", fee: 2500, frequency: "One-time" },
      { particulars: "Monthly GST Return Filing & Reconciliation", fee: 3000, frequency: "Monthly" },
    ],
    termsItems: DEFAULT_TERMS,
  },
  AUDIT: {
    title: "Statutory Audit Services",
    subtitle: "Professional Services Proposal",
    statHighlights: DEFAULT_STATS,
    aboutPoints: DEFAULT_ABOUT_POINTS,
    scopeItems: [
      { title: "Audit Planning", description: "Risk assessment, materiality determination, and audit plan finalization." },
      { title: "Fieldwork & Substantive Testing", description: "Verification of books, vouching, and testing of key balances and transactions." },
      { title: "Draft Financials & Report", description: "Preparation of draft financial statements and the statutory audit report." },
      { title: "Board / AGM Support", description: "Support for board approval and AGM presentation of audited financials." },
    ],
    feeItems: [
      { particulars: "Statutory Audit — FY", fee: 40000, frequency: "Annual" },
    ],
    termsItems: DEFAULT_TERMS,
  },
  TDS: {
    title: "TDS Compliance Services",
    subtitle: "Professional Services Proposal",
    statHighlights: DEFAULT_STATS,
    aboutPoints: DEFAULT_ABOUT_POINTS,
    scopeItems: [
      { title: "TDS Advisory", description: "Section-wise TDS applicability and rate advisory on vendor/employee payments." },
      { title: "Return Filing", description: "Quarterly TDS return filing (Form 24Q/26Q) within due dates." },
      { title: "Certificates", description: "Form 16/16A generation and issuance." },
      { title: "Compliance Health-Check", description: "Periodic review to catch short-deduction or late-payment risk early." },
    ],
    feeItems: [
      { particulars: "Quarterly TDS Return Filing & Advisory", fee: 5000, frequency: "Quarterly" },
    ],
    termsItems: DEFAULT_TERMS,
  },
  OTHER: {
    title: "Professional Services Proposal",
    subtitle: "Professional Services Proposal",
    statHighlights: DEFAULT_STATS,
    aboutPoints: DEFAULT_ABOUT_POINTS,
    scopeItems: [
      { title: "Scope Item 1", description: "Describe the first area of work." },
    ],
    feeItems: [
      { particulars: "Professional Fees", fee: 10000, frequency: "One-time" },
    ],
    termsItems: DEFAULT_TERMS,
  },
};

export function getQuotationPreset(serviceType: string): QuotationPreset {
  return PRESETS[(serviceType as QuotationServiceType) in PRESETS ? (serviceType as QuotationServiceType) : "OTHER"];
}
