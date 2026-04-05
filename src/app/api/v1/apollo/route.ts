import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";

const APOLLO_BASE = "https://api.apollo.io/v1";
const APOLLO_KEY = process.env.APOLLO_API_KEY;

const getSchema = z.object({
  action: z.enum(["lists"]).default("lists"),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    limit: z.number().int().positive().max(100).optional().default(25),
    q: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    domain: z.string().optional(),
    location: z.string().optional(),
  }),
  z.object({
    action: z.literal("enrich"),
    email: z.string().optional(),
    domain: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    linkedin_url: z.string().optional(),
  }),
  z.object({
    action: z.literal("org_enrich"),
    domain: z.string().optional(),
  }),
]);

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

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    switch (parsed.data.action) {
      case "lists":
        return NextResponse.json(await apolloGet("labels"));
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();
  const parsed = postSchema.safeParse({ action: "search", ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    switch (data.action) {
      case "search": {
        const searchBody: Record<string, unknown> = {
          per_page: data.limit,
        };
        if (data.q) searchBody.q_keywords = data.q;
        if (data.title) searchBody.person_titles = [data.title];
        if (data.company) searchBody.q_organization_name = data.company;
        if (data.domain) searchBody.organization_domains = [data.domain];
        if (data.location) searchBody.person_locations = [data.location];
        return NextResponse.json(await apolloPost("mixed_people/search", searchBody));
      }
      case "enrich": {
        const enrichBody: Record<string, unknown> = {};
        if (data.email) enrichBody.email = data.email;
        if (data.domain) enrichBody.domain = data.domain;
        if (data.first_name) enrichBody.first_name = data.first_name;
        if (data.last_name) enrichBody.last_name = data.last_name;
        if (data.linkedin_url) enrichBody.linkedin_url = data.linkedin_url;
        return NextResponse.json(await apolloPost("people/match", enrichBody));
      }
      case "org_enrich": {
        const orgBody: Record<string, unknown> = {};
        if (data.domain) orgBody.domain = data.domain;
        return NextResponse.json(await apolloPost("organizations/enrich", orgBody));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
