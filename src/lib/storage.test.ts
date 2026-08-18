import fs from "fs/promises";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Real filesystem, real (unmocked) readLocalFile/storeFile/getDownloadUrl —
// this is exactly the security-critical logic from the path-traversal
// incident, so it's tested against real files, not a mock. All test
// artifacts live under this project's own uploads/ dir (matching
// production's real layout: uploads/ sits directly under the app root) and
// are removed in afterAll. No real client documents are used.
const uploadsRoot = path.join(process.cwd(), "uploads");
const outsideFile = path.join(process.cwd(), "outside-secret-TEST.txt");
const legitDir = path.join(uploadsRoot, "firmTest", "clientTest");
const legitKey = "firmTest/clientTest/legit-TEST.txt";

beforeAll(async () => {
  await fs.mkdir(legitDir, { recursive: true });
  await fs.writeFile(path.join(uploadsRoot, legitKey), "LEGIT FILE CONTENTS");
  await fs.writeFile(outsideFile, "OUTSIDE UPLOADS ROOT — MUST NEVER BE READABLE VIA A STORAGE KEY");
});

afterAll(async () => {
  await fs.rm(uploadsRoot, { recursive: true, force: true });
  await fs.rm(outsideFile, { force: true });
});

describe("readLocalFile — containment (defense in depth)", () => {
  it("H. legitimate key succeeds", async () => {
    const { readLocalFile } = await import("./storage");
    const buf = await readLocalFile(legitKey);
    expect(buf.toString("utf8")).toBe("LEGIT FILE CONTENTS");
  });

  it("G. plain ../../ traversal is rejected, not read", async () => {
    const { readLocalFile } = await import("./storage");
    await expect(readLocalFile("firmTest/../../outside-secret-TEST.txt")).rejects.toThrow(/escapes the uploads root/);
  });

  it("J. deeper nested traversal is rejected", async () => {
    const { readLocalFile } = await import("./storage");
    await expect(readLocalFile("firmTest/../../../../../../outside-secret-TEST.txt")).rejects.toThrow(/escapes the uploads root/);
  });

  it("I. absolute-path-shaped key never returns real filesystem content outside uploads/", async () => {
    // path.join (not path.resolve) is used deliberately in resolveContainedPath
    // specifically so an absolute-looking segment can't override the base —
    // it gets treated as a literal nested path segment instead. That means
    // this case never even reaches the "escapes the uploads root" branch; it
    // resolves to a nonexistent path *inside* uploads/ and fails with a
    // plain file-not-found error. Either way the security property that
    // actually matters — never returning C:\Windows\win.ini's / /etc/passwd's
    // real content — holds, so the test asserts that outcome directly rather
    // than a specific (OS-dependent) error shape.
    const { readLocalFile } = await import("./storage");
    const absoluteAttempt = process.platform === "win32" ? "C:\\Windows\\win.ini" : "/etc/passwd";
    await expect(readLocalFile(absoluteAttempt)).rejects.toBeTruthy();
  });

  it("rejects a key that resolves exactly to a sibling of uploads/ via a single directory-name collision (e.g. 'uploads-evil')", async () => {
    // Guards the "startsWith without a trailing separator" footgun: a naive
    // `resolved.startsWith(UPLOAD_ROOT)` check (no separator) would wrongly
    // allow a sibling directory whose name happens to start with the same
    // prefix, e.g. resolving into "uploads-evil" because it starts with
    // "uploads". This can't be reached through a legitimate storage key
    // (path.join always inserts a separator), but is worth locking down
    // explicitly since it's the single most common containment-check bug.
    const { readLocalFile } = await import("./storage");
    await expect(readLocalFile("../uploads-evil/x.txt")).rejects.toThrow(/escapes the uploads root/);
  });
});

describe("getDownloadUrl — local mode returns Document-ID-based URLs, never a filesystem key", () => {
  it("staff (portal=false, default): /api/documents/local/{documentId}", async () => {
    const { getDownloadUrl } = await import("./storage");
    const url = await getDownloadUrl(legitKey, "doc_123");
    expect(url).toBe("/api/documents/local/doc_123");
    expect(url).not.toContain("firmTest"); // the raw storage key must never leak into the URL
  });

  it("portal=true: /api/portal/documents/local/{documentId}", async () => {
    const { getDownloadUrl } = await import("./storage");
    const url = await getDownloadUrl(legitKey, "doc_456", true);
    expect(url).toBe("/api/portal/documents/local/doc_456");
  });
});

describe("K. S3 mode — regression, unaffected by the local-storage fix", () => {
  const putObjectCalls: any[] = [];
  const getSignedUrlCalls: any[] = [];

  beforeAll(() => {
    vi.doMock("@aws-sdk/client-s3", () => ({
      S3Client: class {
        send(cmd: any) {
          putObjectCalls.push(cmd);
          return Promise.resolve({});
        }
      },
      PutObjectCommand: class {
        constructor(public input: any) {}
      },
      GetObjectCommand: class {
        constructor(public input: any) {}
      },
    }));
    vi.doMock("@aws-sdk/s3-request-presigner", () => ({
      getSignedUrl: (_client: unknown, command: any) => {
        getSignedUrlCalls.push(command);
        return Promise.resolve(`https://signed.example/${command.input.Key}`);
      },
    }));
  });

  afterAll(() => {
    vi.doUnmock("@aws-sdk/client-s3");
    vi.doUnmock("@aws-sdk/s3-request-presigner");
    vi.resetModules();
  });

  it("storeFile uploads to S3 (not disk) when S3 env vars are configured, key unchanged", async () => {
    vi.resetModules();
    vi.stubEnv("S3_ENDPOINT", "https://s3.example.com");
    vi.stubEnv("S3_BUCKET", "test-bucket");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-key-id");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
    const { storeFile, isS3Configured } = await import("./storage");
    expect(isS3Configured).toBe(true);
    await storeFile("someFirm/someClient/file.pdf", Buffer.from("data"), "application/pdf");
    expect(putObjectCalls[0].input.Key).toBe("someFirm/someClient/file.pdf");
    vi.unstubAllEnvs();
  });

  it("getDownloadUrl returns a signed S3 URL keyed by the storage key, not the document ID, when S3 is configured", async () => {
    vi.resetModules();
    vi.stubEnv("S3_ENDPOINT", "https://s3.example.com");
    vi.stubEnv("S3_BUCKET", "test-bucket");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test-key-id");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "test-secret");
    const { getDownloadUrl } = await import("./storage");
    const url = await getDownloadUrl("someFirm/someClient/file.pdf", "doc_789");
    expect(url).toBe("https://signed.example/someFirm/someClient/file.pdf");
    expect(getSignedUrlCalls[getSignedUrlCalls.length - 1].input.Key).toBe("someFirm/someClient/file.pdf");
    vi.unstubAllEnvs();
  });
});
