/**
 * In-memory rate limiter for Next.js middleware.
 *
 * Two tiers:
 *   - Auth endpoints (/api/auth/*): 10 req/min per IP
 *   - Proxy endpoints (/api/v1/*):  60 req/min per IP
 *
 * Stale entries are purged every 5 minutes.
 *
 * NOTE: This is a development / single-instance solution. The in-memory Map
 * resets on every cold start in serverless environments (e.g. Vercel), so
 * rate limits are not enforced reliably across invocations.
 *
 * TODO: Replace with Upstash Redis (@upstash/ratelimit) for production
 * serverless deployments. See https://upstash.com/docs/redis/sdks/ratelimit-ts
 */

/**
 * Set RATE_LIMIT_ENABLED=false in your environment to disable rate limiting
 * (useful in serverless until a Redis-backed implementation is in place).
 */
export const RATE_LIMIT_ENABLED =
  process.env.RATE_LIMIT_ENABLED?.toLowerCase() !== "false";

if (!RATE_LIMIT_ENABLED) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "rate_limit_disabled",
      message: "Rate limiting is disabled (RATE_LIMIT_ENABLED=false). Auth and API endpoints are unprotected from brute force. Set up Upstash Redis for production rate limiting.",
      timestamp: new Date().toISOString(),
    })
  );
}

type BucketEntry = {
  timestamps: number[];
};

const authBuckets = new Map<string, BucketEntry>();
const apiBuckets = new Map<string, BucketEntry>();

const AUTH_LIMIT = 10;
const AUTH_WINDOW_MS = 60_000;

const API_LIMIT = 60;
const API_WINDOW_MS = 60_000;

const CLEANUP_INTERVAL_MS = 5 * 60_000;

// --- periodic cleanup ---------------------------------------------------

function purgeStaleEntries(buckets: Map<string, BucketEntry>, windowMs: number) {
  const cutoff = Date.now() - windowMs;

  for (const [key, entry] of buckets) {
    entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

    if (entry.timestamps.length === 0) {
      buckets.delete(key);
    }
  }
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanupScheduled() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    purgeStaleEntries(authBuckets, AUTH_WINDOW_MS);
    purgeStaleEntries(apiBuckets, API_WINDOW_MS);
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent the process from exiting
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// --- core check ---------------------------------------------------------

function isRateLimited(
  buckets: Map<string, BucketEntry>,
  ip: string,
  limit: number,
  windowMs: number,
): { limited: boolean; retryAfterSeconds: number } {
  ensureCleanupScheduled();

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = buckets.get(ip);

  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(ip, entry);
  }

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= limit) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = oldestInWindow + windowMs - now;
    return { limited: true, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  entry.timestamps.push(now);
  return { limited: false, retryAfterSeconds: 0 };
}

// --- public API ---------------------------------------------------------

export function checkAuthRateLimit(ip: string) {
  return isRateLimited(authBuckets, ip, AUTH_LIMIT, AUTH_WINDOW_MS);
}

export function checkApiRateLimit(ip: string) {
  return isRateLimited(apiBuckets, ip, API_LIMIT, API_WINDOW_MS);
}

/** Maximum body size (in bytes) for POST/PUT/PATCH to /api/v1/*. */
export const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1 MB
