import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";

const OURA_BASE = "https://api.ouraring.com/v2/usercollection";
const OURA_TOKEN = process.env.OURA_PERSONAL_ACCESS_TOKEN;

const getSchema = z.object({
  action: z.enum(["daily_sleep", "daily_readiness", "daily_activity", "heartrate", "sleep", "personal_info"]).default("daily_sleep"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD").optional(),
});

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

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, start_date, end_date } = parsed.data;

  try {
    const params: Record<string, string> = {};
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;

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
    }
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
