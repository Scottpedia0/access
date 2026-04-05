import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";

const OURA_BASE = "https://api.ouraring.com/v2/usercollection";
const OURA_TOKEN = process.env.OURA_PERSONAL_ACCESS_TOKEN;

function auth(request: NextRequest): NextResponse | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !isValidGlobalAgentToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function ouraFetch(path: string, params: Record<string, string>) {
  if (!OURA_TOKEN) {
    throw new Error("OURA_PERSONAL_ACCESS_TOKEN not set");
  }

  const url = new URL(`${OURA_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${OURA_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`Oura API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function GET(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const action = request.nextUrl.searchParams.get("action") ?? "daily_sleep";
  const startDate = request.nextUrl.searchParams.get("start_date") ?? "";
  const endDate = request.nextUrl.searchParams.get("end_date") ?? "";

  try {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    switch (action) {
      case "daily_sleep":
        return NextResponse.json(await ouraFetch("daily_sleep", params));
      case "daily_readiness":
        return NextResponse.json(await ouraFetch("daily_readiness", params));
      case "daily_activity":
        return NextResponse.json(await ouraFetch("daily_activity", params));
      case "heartrate":
        return NextResponse.json(await ouraFetch("heartrate", params));
      case "sleep":
        return NextResponse.json(await ouraFetch("sleep", params));
      case "personal_info":
        return NextResponse.json(await ouraFetch("personal_info", {}));
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Use: daily_sleep, daily_readiness, daily_activity, heartrate, sleep, personal_info` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
