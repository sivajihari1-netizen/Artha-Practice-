import { createHash } from "crypto";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Strips directory separators and ".." segments before a client-supplied
 * filename is joined into a storage key — without this, a filename like
 * "../../evil.pdf" ends up baked into the key path unsanitized.
 */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, ""); // drop any embedded path, keep only the final segment
  const cleaned = base.replace(/\.\./g, "").replace(/[^\w.\-]/g, "_");
  return cleaned || "file";
}

export function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** A single sane retention default (8 years) — see scripts/backfill-document-retention.mjs for the rationale. */
export function defaultRetentionExpiry(from: Date = new Date()): Date {
  const result = new Date(from);
  result.setFullYear(result.getFullYear() + 8);
  return result;
}
