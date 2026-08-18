import crypto from "crypto";

// AES-256-GCM encryption for sensitive fields (client portal credentials, etc).
// Requires a 32-byte key in CREDENTIALS_ENC_KEY (base64), e.g. generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const b64 = process.env.CREDENTIALS_ENC_KEY;
  if (!b64) {
    throw new Error(
      "CREDENTIALS_ENC_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" and add it to .env"
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENC_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

/** Encrypts plaintext, returning a single string: iv:authTag:ciphertext (all base64). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload");
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
