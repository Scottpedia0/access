import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl, isValidAlias } from "@/lib/google/accounts";

export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account");

  if (!account || !isValidAlias(account)) {
    return NextResponse.json(
      {
        error: "Missing or invalid account parameter. Use: go2, personal, or moran",
      },
      { status: 400 }
    );
  }

  const url = getAuthUrl(account);
  return NextResponse.redirect(url);
}
