import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";

const APOLLO_BASE = "https://api.apollo.io/v1";
const APOLLO_KEY = process.env.APOLLO_API_KEY;

function auth(request: NextRequest): NextResponse | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !isValidGlobalAgentToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function apolloPost(path: string, body: Record<string, unknown>) {
  if (!APOLLO_KEY) {
    throw new Error("APOLLO_API_KEY not set");
  }

  const res = await fetch(`${APOLLO_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": APOLLO_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Apollo API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function apolloGet(path: string) {
  if (!APOLLO_KEY) {
    throw new Error("APOLLO_API_KEY not set");
  }

  const res = await fetch(`${APOLLO_BASE}/${path}`, {
    headers: { "X-Api-Key": APOLLO_KEY },
  });

  if (!res.ok) {
    throw new Error(`Apollo API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function GET(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const action = request.nextUrl.searchParams.get("action") ?? "search";

  try {
    switch (action) {
      case "lists":
        return NextResponse.json(await apolloGet("labels"));
      default:
        return NextResponse.json(
          { error: `Unknown GET action: ${action}. Use: lists` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();
  const action = body.action ?? "search";

  try {
    switch (action) {
      case "search": {
        const searchBody: Record<string, unknown> = {
          per_page: body.limit ?? 25,
        };
        if (body.q) searchBody.q_keywords = body.q;
        if (body.title) searchBody.person_titles = [body.title];
        if (body.company) searchBody.q_organization_name = body.company;
        if (body.domain) searchBody.organization_domains = [body.domain];
        if (body.location) searchBody.person_locations = [body.location];
        return NextResponse.json(await apolloPost("mixed_people/search", searchBody));
      }
      case "enrich": {
        const enrichBody: Record<string, unknown> = {};
        if (body.email) enrichBody.email = body.email;
        if (body.domain) enrichBody.domain = body.domain;
        if (body.first_name) enrichBody.first_name = body.first_name;
        if (body.last_name) enrichBody.last_name = body.last_name;
        if (body.linkedin_url) enrichBody.linkedin_url = body.linkedin_url;
        return NextResponse.json(await apolloPost("people/match", enrichBody));
      }
      case "org_enrich": {
        const orgBody: Record<string, unknown> = {};
        if (body.domain) orgBody.domain = body.domain;
        return NextResponse.json(await apolloPost("organizations/enrich", orgBody));
      }
      default:
        return NextResponse.json(
          { error: `Unknown POST action: ${action}. Use: search, enrich, org_enrich` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
