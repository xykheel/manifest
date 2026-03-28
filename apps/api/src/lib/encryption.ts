import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Returns the 32-byte encryption key.
 *
 * Production: ENCRYPTION_KEY env var must be exactly 64 hex characters (32 bytes).
 * Development: Falls back to an all-zero key with a console warning so the app
 * works without configuration. Do NOT use the fallback in production — stored
 * ciphertext would be trivially decryptable.
 */
function getKey(): Buffer {
  const raw = (process.env.ENCRYPTION_KEY ?? "").trim();

  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  if (raw.length > 0) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ENCRYPTION_KEY is required in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  console.warn(
    "[manifest] WARNING: ENCRYPTION_KEY is not set. Using an insecure dev-only fallback key. " +
      "Add ENCRYPTION_KEY to apps/api/.env before going to production.",
  );
  return Buffer.alloc(32, 0);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
 * Returns an empty string for empty input (no-op).
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";

  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a value produced by `encrypt`.
 * Returns an empty string for empty or malformed input.
 */
export function decrypt(stored: string): string {
  if (!stored) return "";

  const parts = stored.split(":");
  if (parts.length !== 3) return "";

  const [ivHex, tagHex, dataHex] = parts;

  try {
    const key = getKey();
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
