import { NextRequest, NextResponse } from "next/server";

import {
  checkAuthRateLimit,
  checkApiRateLimit,
  MAX_BODY_SIZE,
  RATE_LIMIT_ENABLED,
} from "@/lib/middleware/rate-limit";

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    (request as unknown as { ip?: string }).ip ||
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // --- Rate limiting: auth endpoints ------------------------------------
  // Set RATE_LIMIT_ENABLED=false to disable (e.g. in serverless without Redis)
  if (RATE_LIMIT_ENABLED && pathname.startsWith("/api/auth")) {
    const { limited, retryAfterSeconds } = checkAuthRateLimit(ip);

    if (limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }
  }

  // --- Rate limiting: proxy / v1 endpoints ------------------------------
  if (RATE_LIMIT_ENABLED && pathname.startsWith("/api/v1")) {
    const { limited, retryAfterSeconds } = checkApiRateLimit(ip);

    if (limited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }
  }

  // --- Auth gate: require credentials on all /api/v1/* routes -----------
  // This ensures no route can accidentally ship without auth.
  // Route handlers still do the actual validation (token validity, grants,
  // etc.), but this catches the "forgot to add auth check" case.
  if (pathname.startsWith("/api/v1")) {
    const authHeader = request.headers.get("authorization") ?? "";
    const hasValidAuthHeader = /^Bearer\s+\S+/i.test(authHeader);
    const hasSessionCookie = request.cookies.has("next-auth.session-token") ||
      request.cookies.has("__Secure-next-auth.session-token");

    if (!hasValidAuthHeader && !hasSessionCookie) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "auth_missing",
          message: "Request to /api/v1/* with no Authorization header or session cookie",
          path: pathname,
          ip,
          timestamp: new Date().toISOString(),
        })
      );
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  // --- Body size limit for mutating methods -----------------------------
  // NOTE: This Content-Length check is an extra layer, not the only one.
  // Next.js enforces body limits at the framework level (default 1 MB for
  // API routes). This catches oversized requests early but does not cover
  // chunked Transfer-Encoding where Content-Length is absent.
  if (pathname.startsWith("/api/v1")) {
    const method = request.method.toUpperCase();

    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const contentLength = request.headers.get("content-length");

      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        return NextResponse.json(
          { error: "Payload Too Large. Maximum body size is 1 MB." },
          { status: 413 },
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/:path*", "/api/v1/:path*"],
};
