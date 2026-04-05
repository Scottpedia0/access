import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import { isValidAlias, type AccountAlias } from "./accounts";

export type AuthenticatedGoogleRequest = {
  account: AccountAlias;
};

export function authenticateGoogleRequest(
  request: NextRequest,
  accountOverride?: string | null
): AuthenticatedGoogleRequest | NextResponse {
  const auth = request.headers.get("authorization");
  const token = auth?.replace(/^Bearer\s+/i, "");

  if (!token || !isValidGlobalAgentToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = accountOverride ?? request.nextUrl.searchParams.get("account");

  if (!account || !isValidAlias(account)) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid "account" parameter. Use: go2, personal, or moran',
      },
      { status: 400 }
    );
  }

  return { account };
}
