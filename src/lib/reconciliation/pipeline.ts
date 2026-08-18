// Pipeline orchestrator (spec section 4, steps EXTRACT through ESCALATE).
// Runs synchronously within the API request that receives the uploaded
// files — see the processing-model decision in the API route: no job/queue
// infrastructure exists in this app yet, and CSV/Excel/JSON parsing +
// deterministic matching for a purchase register or bank statement is fast
// enough (sub-second to a few seconds) not to need one. Structured as a
// sequence of discrete steps so it can move behind a queue later without a
// rewrite if volume or PDF OCR (Phase 7, not built yet) ever requires it.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/auditLog";
import { extractGstr2bJson, extractTabular, detectFileKind, ExtractionError, type ExtractInput } from "./extract";
import { match } from "./match";
import { explainException } from "./explain";
import { computeMaterialityAmount, computeRiskScore, DEFAULT_ESCALATION_THRESHOLD, DEFAULT_MATERIALITY_THRESHOLD } from "./risk";
import type { ReconciliationSourceType } from "./columnMapping";
import type { ExtractedRow, MatchResult, ReconciliationType } from "./types";

export class PipelineError extends Error {}

/** Which stored column-mapping "source type" and which extraction path (JSON vs tabular) each side of each reconciliation type uses. */
function sourceTypesFor(type: ReconciliationType): { a: ReconciliationSourceType; b: ReconciliationSourceType; aAllowsJson: boolean } {
  switch (type) {
    case "GST_2B_VS_PURCHASE":
      return { a: "gstr2b", b: "purchase_register", aAllowsJson: true };
    case "GST_1_VS_SALES":
      return { a: "gstr1", b: "sales_register", aAllowsJson: true };
    case "BANK_VS_BOOKS":
      return { a: "bank_ledger", b: "bank_ledger", aAllowsJson: false }; // bank statement (A) and books ledger (B) share column-mapping vocabulary
  }
}

async function extractSide(params: {
  input: ExtractInput;
  source: "A" | "B";
  type: ReconciliationType;
  clientId: string;
  sourceType: ReconciliationSourceType;
  allowJson: boolean;
}): Promise<ExtractedRow[]> {
  const kind = detectFileKind(params.input);
  if (kind === "json") {
    if (!params.allowJson) {
      throw new ExtractionError("JSON upload isn't supported for this source — use CSV or Excel.");
    }
    const { items } = await extractGstr2bJson({ input: params.input, source: params.source, clientId: params.clientId });
    return items;
  }
  const { items } = await extractTabular({
    input: params.input,
    source: params.source,
    type: params.type,
    clientId: params.clientId,
    sourceType: params.sourceType,
  });
  return items;
}

/** How much materiality risk this pair's counterparty/GSTIN has previously shown, for the recurrence term in risk scoring. */
async function hasRecurredBefore(params: { clientId: string; gstin: string | null; counterparty: string | null }): Promise<boolean> {
  if (!params.gstin && !params.counterparty) return false;
  const existing = await prisma.reconciliationMatch.findFirst({
    where: {
      status: "EXCEPTION",
      reconciliationRun: { clientId: params.clientId },
      OR: [
        ...(params.gstin
          ? [{ lineItemA: { is: { gstin: params.gstin } } }, { lineItemB: { is: { gstin: params.gstin } } }]
          : []),
        ...(params.counterparty
          ? [{ lineItemA: { is: { counterparty: params.counterparty } } }, { lineItemB: { is: { counterparty: params.counterparty } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  return !!existing;
}

export async function runReconciliationPipeline(params: {
  runId: string;
  firmId: string;
  clientId: string;
  type: ReconciliationType;
  sourceA: ExtractInput;
  sourceB: ExtractInput;
  createdById?: string | null;
  materialityThreshold?: number;
  escalationThreshold?: number;
}): Promise<{ matchedCount: number; exceptionCount: number; escalatedCount: number }> {
  const { runId, firmId, clientId, type } = params;
  const { a: sourceTypeA, b: sourceTypeB, aAllowsJson } = sourceTypesFor(type);

  try {
    await prisma.reconciliationRun.update({ where: { id: runId }, data: { status: "EXTRACTING" } });

    const [itemsA, itemsB] = await Promise.all([
      extractSide({ input: params.sourceA, source: "A", type, clientId, sourceType: sourceTypeA, allowJson: aAllowsJson }),
      extractSide({ input: params.sourceB, source: "B", type, clientId, sourceType: sourceTypeB, allowJson: false }),
    ]);

    await prisma.reconciliationRun.update({ where: { id: runId }, data: { status: "EXTRACTED" } });

    // Persist extracted rows first (raw audit trail — spec section 5's "never silently drop a row"
    // requirement starts here: every row that was extracted gets a permanent record even before matching).
    const [createdA, createdB] = await Promise.all([
      persistLineItems(runId, itemsA),
      persistLineItems(runId, itemsB),
    ]);

    await prisma.reconciliationRun.update({ where: { id: runId }, data: { status: "MATCHING" } });

    const results = match({ type, itemsA, itemsB });

    // Map ExtractedRow (in-memory) back to its persisted ExtractedLineItem id, by array position —
    // extractSide/persistLineItems preserve order, so this is a direct positional lookup.
    const idForRowA = new Map(itemsA.map((row, i) => [row, createdA[i].id]));
    const idForRowB = new Map(itemsB.map((row, i) => [row, createdB[i].id]));

    const summary = await persistMatchResultsAndEscalate({
      runId,
      firmId,
      clientId,
      type,
      results,
      idForRowA,
      idForRowB,
      materialityThreshold: params.materialityThreshold,
      escalationThreshold: params.escalationThreshold,
    });

    await logAudit({
      firmId,
      userId: params.createdById,
      action: "reconciliation.run_completed",
      targetType: "ReconciliationRun",
      targetId: runId,
      metadata: { type, ...summary },
    });

    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during reconciliation";
    await prisma.reconciliationRun.update({ where: { id: runId }, data: { status: "FAILED", errorMessage: message } });
    if (err instanceof ExtractionError) throw new PipelineError(message);
    throw err;
  }
}

/**
 * Re-runs MATCH → CLASSIFY → EXPLAIN → ESCALATE against the already-extracted
 * line items for a run — no re-upload, no re-parsing. For use after a
 * correction (e.g. a column mapping was fixed) rather than a brand new
 * upload. Existing ReconciliationMatch rows for the run are discarded and
 * regenerated; any tasks created by the previous run stay in the task
 * system (only their link back to a match row is dropped), and any
 * resolution notes staff had already recorded are lost — this is a known v1
 * limitation, not a silent one.
 */
export async function rerunReconciliationMatching(params: {
  runId: string;
  materialityThreshold?: number;
  escalationThreshold?: number;
}): Promise<{ matchedCount: number; exceptionCount: number; escalatedCount: number }> {
  const run = await prisma.reconciliationRun.findUnique({ where: { id: params.runId } });
  if (!run) throw new PipelineError("Reconciliation run not found");

  const lineItems = await prisma.extractedLineItem.findMany({ where: { reconciliationRunId: run.id } });
  const toExtractedRow = (item: (typeof lineItems)[number]): ExtractedRow => ({
    source: item.source,
    rawRow: item.rawRow as Record<string, unknown>,
    normalizedKey: item.normalizedKey,
    date: item.date ? item.date.toISOString() : null,
    amount: item.amount,
    taxAmount: item.taxAmount,
    counterparty: item.counterparty,
    referenceNo: item.referenceNo,
    gstin: item.gstin,
    direction: null, // not persisted — match() only reads it via normalizedKey, computed once at extraction time
    confidenceScore: item.confidenceScore,
    extractionMethod: item.extractionMethod,
  });

  const itemsA = lineItems.filter((i) => i.source === "A").map(toExtractedRow);
  const itemsB = lineItems.filter((i) => i.source === "B").map(toExtractedRow);
  const dbItemsA = lineItems.filter((i) => i.source === "A");
  const dbItemsB = lineItems.filter((i) => i.source === "B");
  const idForRowA = new Map(itemsA.map((row, i) => [row, dbItemsA[i].id]));
  const idForRowB = new Map(itemsB.map((row, i) => [row, dbItemsB[i].id]));

  await prisma.reconciliationMatch.deleteMany({ where: { reconciliationRunId: run.id } });
  await prisma.reconciliationRun.update({ where: { id: run.id }, data: { status: "MATCHING" } });

  const results = match({ type: run.type, itemsA, itemsB });

  const summary = await persistMatchResultsAndEscalate({
    runId: run.id,
    firmId: run.firmId,
    clientId: run.clientId,
    type: run.type,
    results,
    idForRowA,
    idForRowB,
    materialityThreshold: params.materialityThreshold,
    escalationThreshold: params.escalationThreshold,
  });

  await logAudit({
    firmId: run.firmId,
    action: "reconciliation.run_rerun",
    targetType: "ReconciliationRun",
    targetId: run.id,
    metadata: summary,
  });

  return summary;
}

async function persistMatchResultsAndEscalate(params: {
  runId: string;
  firmId: string;
  clientId: string;
  type: ReconciliationType;
  results: MatchResult[];
  idForRowA: Map<ExtractedRow, string>;
  idForRowB: Map<ExtractedRow, string>;
  materialityThreshold?: number;
  escalationThreshold?: number;
}): Promise<{ matchedCount: number; exceptionCount: number; escalatedCount: number }> {
  const { runId, firmId, clientId, type, results, idForRowA, idForRowB } = params;
  let matchedCount = 0;
  let exceptionCount = 0;
  let escalatedCount = 0;
  const materialityThreshold = params.materialityThreshold ?? DEFAULT_MATERIALITY_THRESHOLD;
  const escalationThreshold = params.escalationThreshold ?? DEFAULT_ESCALATION_THRESHOLD;

  for (const result of results) {
    const materialityAmount = computeMaterialityAmount(result.rowA?.amount ?? null, result.rowB?.amount ?? null);
    const gstin = result.rowA?.gstin ?? result.rowB?.gstin ?? null;
    const counterparty = result.rowA?.counterparty ?? result.rowB?.counterparty ?? null;
    const recurred = result.exceptionReason ? await hasRecurredBefore({ clientId, gstin, counterparty }) : false;
    const riskScore = computeRiskScore({
      materialityAmount,
      exceptionReason: result.exceptionReason,
      hasRecurredBefore: recurred,
      materialityThreshold,
    });
    const explanation = result.exceptionReason ? explainException({ type, reason: result.exceptionReason, rowA: result.rowA, rowB: result.rowB }) : null;

    const created = await prisma.reconciliationMatch.create({
      data: {
        reconciliationRunId: runId,
        lineItemAId: result.rowA ? idForRowA.get(result.rowA) : null,
        lineItemBId: result.rowB ? idForRowB.get(result.rowB) : null,
        matchType: result.matchType,
        matchConfidence: result.matchConfidence,
        status: result.status,
        exceptionReason: result.exceptionReason,
        exceptionExplanation: explanation,
        materialityAmount,
        riskScore,
      },
    });

    if (result.status === "MATCHED") matchedCount++;
    else exceptionCount++;

    if (result.status === "EXCEPTION" && riskScore > escalationThreshold) {
      await escalateToTask({ firmId, clientId, type, match: created, explanation: explanation ?? "Reconciliation exception needs review." });
      escalatedCount++;
    }
  }

  await prisma.reconciliationRun.update({
    where: { id: runId },
    data: { status: "MATCHED", matchedCount, exceptionCount },
  });

  return { matchedCount, exceptionCount, escalatedCount };
}

function persistLineItems(runId: string, items: ExtractedRow[]) {
  // Sequential creates (not createMany) so each row's DB id can be matched back
  // to its in-memory ExtractedRow by position for linking ReconciliationMatch rows.
  return Promise.all(
    items.map((item) =>
      prisma.extractedLineItem.create({
        data: {
          reconciliationRunId: runId,
          source: item.source,
          rawRow: item.rawRow as Prisma.InputJsonValue,
          normalizedKey: item.normalizedKey,
          date: item.date ? new Date(item.date) : null,
          amount: item.amount,
          taxAmount: item.taxAmount,
          counterparty: item.counterparty,
          referenceNo: item.referenceNo,
          gstin: item.gstin,
          confidenceScore: item.confidenceScore,
          extractionMethod: item.extractionMethod,
        },
      })
    )
  );
}

/** ESCALATE step (spec section 4/8) — creates a task in the existing task system, linked back to the match. Never writes to the client's books/ledger. */
async function escalateToTask(params: {
  firmId: string;
  clientId: string;
  type: ReconciliationType;
  match: { id: string };
  explanation: string;
}) {
  const returnType = params.type === "BANK_VS_BOOKS" ? "OTHER" : "GST";
  const title =
    params.type === "BANK_VS_BOOKS" ? "Bank reconciliation exception" : params.type === "GST_1_VS_SALES" ? "GSTR-1 reconciliation exception" : "GSTR-2B reconciliation exception";

  const task = await prisma.task.create({
    data: {
      firmId: params.firmId,
      clientId: params.clientId,
      title,
      description: params.explanation,
      returnType,
    },
  });

  await prisma.reconciliationMatch.update({ where: { id: params.match.id }, data: { taskId: task.id } });

  await logAudit({
    firmId: params.firmId,
    action: "reconciliation.exception_escalated",
    targetType: "ReconciliationMatch",
    targetId: params.match.id,
    metadata: { taskId: task.id },
  });
}
