import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { getConsumerTokenHashSecret } from "@/lib/env";

const TOKEN_PREFIX = "amb_live";

export function issueConsumerToken() {
  const shortPrefix = randomBytes(6).toString("hex");
  const secretPart = randomBytes(24).toString("base64url");
  const tokenPrefix = `${TOKEN_PREFIX}_${shortPrefix}`;
  const token = `${tokenPrefix}_${secretPart}`;

  return {
    token,
    tokenPrefix,
  };
}

export function extractTokenPrefix(token: string) {
  const parts = token.split("_");

  if (parts.length < 4) {
    return null;
  }

  return parts.slice(0, 3).join("_");
}

export function hashConsumerToken(token: string) {
  return createHmac("sha256", getConsumerTokenHashSecret())
    .update(token)
    .digest("hex");
}

export function verifyConsumerToken(token: string, expectedHash: string) {
  const actual = createHmac("sha256", getConsumerTokenHashSecret()).update(token).digest();
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
