import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { getEncryptionKey } from "@/lib/env";

const ENCRYPTION_VERSION = "v1";
const IV_LENGTH = 12;

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
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecretValue(payload: string) {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] = payload.split(".");

  if (
    version !== ENCRYPTION_VERSION ||
    !ivEncoded ||
    !authTagEncoded ||
    !ciphertextEncoded
  ) {
    throw new Error("Unsupported encrypted payload format.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function maskSecretValue(value: string) {
  if (value.length <= 8) {
    return "••••••••";
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
