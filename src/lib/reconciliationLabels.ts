// Shared display labels for ReconciliationType, used across the F2 run
// list/detail/upload pages. Deliberately NOT wired into F1's already-deployed
// ReconciliationFilterBar.tsx (which keeps its own local copy) — F1 is not
// being modified beyond the one required subnav addition, per this batch's
// explicit instruction to avoid touching already-deployed F1 files.
export const RECONCILIATION_TYPE_LABEL: Record<string, string> = {
  GST_2B_VS_PURCHASE: "GSTR-2B vs Purchase Register",
  GST_1_VS_SALES: "GSTR-1 vs Sales",
  BANK_VS_BOOKS: "Bank vs Books",
};

/** Labels for the two uploaded files, per reconciliation type — matches the wording in POST /api/clients/[id]/reconciliation-runs' own error messages. */
export const SOURCE_A_LABEL: Record<string, string> = {
  GST_2B_VS_PURCHASE: "GSTR-2B export",
  GST_1_VS_SALES: "GSTR-1 export",
  BANK_VS_BOOKS: "Bank statement",
};

export const SOURCE_B_LABEL: Record<string, string> = {
  GST_2B_VS_PURCHASE: "Purchase register",
  GST_1_VS_SALES: "Sales register",
  BANK_VS_BOOKS: "Books export",
};
