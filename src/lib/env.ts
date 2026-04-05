import { timingSafeEqual } from "crypto";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const splitList = (value: string | undefined) =>
  (value ?? "")
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const maybeBase64Key = (value: string) => {
  try {
    const buffer = Buffer.from(value, "base64");
    return buffer.length === 32 ? buffer : null;
  } catch {
    return null;
  }
};

const maybeHexKey = (value: string) => {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    return null;
  }

  const buffer = Buffer.from(value, "hex");
  return buffer.length === 32 ? buffer : null;
};

export const ownerEmails = splitList(process.env.OWNER_EMAILS).map(normalizeEmail);

export const hasGoogleAuth = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const hasEmailMagicLink = Boolean(
  process.env.EMAIL_SERVER && process.env.EMAIL_FROM,
);

export const hasOwnerPasswordAuth = Boolean(process.env.OWNER_LOGIN_PASSWORD);
export const hasSharedIntakeToken = Boolean(process.env.SHARED_INTAKE_TOKEN?.trim());
export const hasGlobalAgentToken = Boolean(process.env.GLOBAL_AGENT_TOKEN?.trim());

export const appName = process.env.APP_NAME ?? "Access";

export function isAllowedOwnerEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return ownerEmails.includes(normalizeEmail(email));
}

export function getEncryptionKey() {
  const raw = process.env.SECRET_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("SECRET_ENCRYPTION_KEY is required.");
  }

  const base64 = maybeBase64Key(raw);
  if (base64) {
    return base64;
  }

  const hex = maybeHexKey(raw);
  if (hex) {
    return hex;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error(
    "SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes (base64, hex, or raw 32-char string).",
  );
}

export function getConsumerTokenHashSecret() {
  const secret = process.env.CONSUMER_TOKEN_HASH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("CONSUMER_TOKEN_HASH_SECRET or NEXTAUTH_SECRET is required.");
  }

  return secret;
}

export function getAppOrigin() {
  const value = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";

  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export function getGlobalAgentToken() {
  return process.env.GLOBAL_AGENT_TOKEN?.trim() || null;
}

export function getSharedIntakeToken() {
  return process.env.SHARED_INTAKE_TOKEN?.trim() || null;
}

export function isValidSharedIntakeToken(value: string | null | undefined) {
  const expected = getSharedIntakeToken();
  const candidate = value?.trim();

  if (!expected || !candidate) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const candidateBuffer = Buffer.from(candidate, "utf8");

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
}

/**
 * Build the shared intake URL with the token as a query parameter.
 *
 * Security note: The intake token appears in the URL, which means it can
 * leak via server access logs, browser history, and HTTP Referer headers.
 * This is an accepted trade-off because:
 *   - The intake token is WRITE-ONLY — it cannot read secrets
 *   - The /add page is designed for quick credential drops by team members
 *   - The alternative (POST-only flow) would require a separate auth step
 * If this trade-off is unacceptable, disable SHARED_INTAKE_TOKEN and use
 * the admin UI or POST /api/v1/intake with a Bearer header instead.
 */
export function getSharedIntakeUrl(serviceName?: string) {
  const token = getSharedIntakeToken();

  if (!token) {
    return null;
  }

  const url = new URL("/add", getAppOrigin());
  url.searchParams.set("t", token);

  if (serviceName?.trim()) {
    url.searchParams.set("service", serviceName.trim());
  }

  return url.toString();
}

export function isValidGlobalAgentToken(value: string | null | undefined) {
  const expected = process.env.GLOBAL_AGENT_TOKEN?.trim();
  const candidate = value?.trim();

  if (!expected || !candidate) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const candidateBuffer = Buffer.from(candidate, "utf8");

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
}
