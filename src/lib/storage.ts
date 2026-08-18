import fs from "fs/promises";
import path from "path";

/**
 * Storage abstraction for the document vault. Two modes:
 *
 * 1. S3-compatible (recommended for production) — set S3_ENDPOINT,
 *    S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env. Works with
 *    AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc. Files are encrypted
 *    at rest by the provider; enable server-side encryption on the bucket.
 *
 * 2. Local disk fallback (dev only) — writes under ./uploads. This does
 *    NOT work on serverless hosts (Vercel, etc.) since the filesystem is
 *    ephemeral/read-only in production. Configure S3 before deploying.
 */

const s3Configured = !!(
  process.env.S3_ENDPOINT &&
  process.env.S3_BUCKET &&
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_SECRET_ACCESS_KEY
);

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

/**
 * Resolves `key` against the uploads root and verifies the result is still
 * contained inside it — defense in depth (production incident: the old
 * /api/documents/local/[...key] route accepted this same kind of key
 * straight from the browser with no containment check at all, and `../../`
 * traversal was proven to escape the uploads root). Every caller of
 * readLocalFile is now expected to pass a trusted, DB-sourced storageKey,
 * never anything derived from a request directly — this check is the
 * backstop for that expectation, not the primary defense.
 *
 * path.join (not path.resolve) is used for the initial join specifically
 * because path.resolve treats an absolute-looking second argument as a full
 * replacement for the base path — path.join does not, so an
 * absolute-path-shaped key is safely treated as a literal path segment
 * instead of escaping straight to that absolute location. The single-arg
 * path.resolve() call afterward only normalizes the already-joined string
 * (collapses any remaining "." / ".." and guarantees an absolute,
 * OS-native-separator form) — it does not carry the two-arg danger since
 * there is only one path being resolved at that point.
 */
function resolveContainedPath(key: string): string {
  const joined = path.join(UPLOAD_ROOT, key);
  const resolved = path.resolve(joined);
  const rootWithSep = UPLOAD_ROOT.endsWith(path.sep) ? UPLOAD_ROOT : UPLOAD_ROOT + path.sep;
  if (resolved !== UPLOAD_ROOT && !resolved.startsWith(rootWithSep)) {
    throw new Error("Resolved path escapes the uploads root");
  }
  return resolved;
}

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  });
}

export async function storeFile(key: string, data: Buffer, mimeType?: string): Promise<void> {
  if (s3Configured) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: mimeType,
        ServerSideEncryption: "AES256",
      })
    );
    return;
  }

  // Local disk fallback
  const dir = path.join(process.cwd(), "uploads", path.dirname(key));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "uploads", key), data);
}

/**
 * `documentId` + `portal` determine the local-mode URL shape — the browser
 * must never receive a filesystem-shaped key again (see the incident this
 * fixes). S3 mode is unaffected: it still uses `key` directly, exactly as
 * before, since a signed S3 URL was never the vulnerable path.
 */
export async function getDownloadUrl(key: string, documentId: string, portal = false): Promise<string> {
  if (s3Configured) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await getS3Client();
    const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
    return getSignedUrl(client, command, { expiresIn: 300 }); // 5 minutes
  }

  // Local dev fallback — served via /api/documents/local/[id] (staff) or
  // /api/portal/documents/local/[id] (client portal), each of which
  // resolves the real storage key from the database itself, never from
  // this URL.
  return portal ? `/api/portal/documents/local/${documentId}` : `/api/documents/local/${documentId}`;
}

export async function readLocalFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveContainedPath(key));
}

export const isS3Configured = s3Configured;
