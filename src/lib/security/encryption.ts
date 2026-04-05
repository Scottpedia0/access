import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { getEncryptionKey } from "@/lib/env";

/**
 * Encryption versioning for key rotation support.
 *
 * - v1: encrypted with SECRET_ENCRYPTION_KEY (original)
 * - v2: encrypted with SECRET_ENCRYPTION_KEY (after rotation)
 *
 * On rotation:
 *   1. Set SECRET_ENCRYPTION_KEY to the new key
 *   2. Set SECRET_ENCRYPTION_KEY_PREVIOUS to the old key
 *   3. Run `npx tsx scripts/rotate-keys.ts` to re-encrypt all secrets
 *   4. After migration completes, remove SECRET_ENCRYPTION_KEY_PREVIOUS
 */

const CURRENT_VERSION = "v2";
const SUPPORTED_VERSIONS = ["v1", "v2"];
const IV_LENGTH = 12;

function getPreviousEncryptionKey(): Buffer | null {
  const raw = process.env.SECRET_ENCRYPTION_KEY_PREVIOUS;
  if (!raw) return null;
  // Accept same formats as the primary key
  if (Buffer.from(raw, "base64").length === 32) return Buffer.from(raw, "base64");
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;
  return null;
}

export function encryptSecretValue(plaintext: string) {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    CURRENT_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecretValue(payload: string) {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] = payload.split(".");

  if (
    !version ||
    !SUPPORTED_VERSIONS.includes(version) ||
    !ivEncoded ||
    !authTagEncoded ||
    !ciphertextEncoded
  ) {
    throw new Error("Unsupported encrypted payload format.");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");

  // Try current key first
  const currentKey = getEncryptionKey();
  try {
    const decipher = createDecipheriv("aes-256-gcm", currentKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Current key didn't work — try previous key if available
  }

  const previousKey = getPreviousEncryptionKey();
  if (previousKey) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", previousKey, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      // Previous key also didn't work
    }
  }

  throw new Error("Failed to decrypt — neither current nor previous encryption key works.");
}

/**
 * Check if a payload needs re-encryption (was encrypted with an older version).
 */
export function needsReEncryption(payload: string): boolean {
  const version = payload.split(".")[0];
  return version !== CURRENT_VERSION;
}

export function maskSecretValue(value: string) {
  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
