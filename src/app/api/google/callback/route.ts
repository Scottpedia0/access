import { NextRequest, NextResponse } from "next/server";
import { handleCallback, isValidAlias } from "@/lib/google/accounts";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code || !state || !isValidAlias(state)) {
    return NextResponse.json(
      { error: "Missing code or invalid state" },
      { status: 400 }
    );
  }

  try {
    await handleCallback(code, state);
    return NextResponse.json({
      ok: true,
      account: state,
      message: `Account "${state}" connected successfully. You can close this tab.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to exchange token", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
