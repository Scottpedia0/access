import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import { getAllProfiles, getProfile } from "@/lib/google/profile";
import type { AccountAlias } from "@/lib/google/accounts";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !isValidGlobalAgentToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = request.nextUrl.searchParams.get("account") as AccountAlias | null;

  try {
    if (account) {
      const profile = await getProfile(account);
      return NextResponse.json(profile);
    }
    const profiles = await getAllProfiles(["go2", "personal", "moran"]);
    return NextResponse.json({ profiles });
  } catch (err) {
    return NextResponse.json({ error: "Profile API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
