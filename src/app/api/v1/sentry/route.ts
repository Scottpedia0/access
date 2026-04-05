import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listProjects, listIssues, getIssue, listEvents, getEvent,
  listReleases, resolveIssue, assignIssue,
} from "@/lib/sentry/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["projects", "issues", "issue", "events", "event", "releases"]).default("projects"),
  project: z.string().min(1).optional(),
  issueId: z.string().min(1).optional(),
  eventId: z.string().min(1).optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(25),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("resolve"), issueId: z.string().min(1) }),
  z.object({ action: z.literal("assign"), issueId: z.string().min(1), assignee: z.string().min(1) }),
]);

function auth(request: NextRequest): NextResponse | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !isValidGlobalAgentToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, project, issueId, eventId, query, limit } = parsed.data;

  try {
    switch (action) {
      case "projects":
        return NextResponse.json(await listProjects());
      case "issues": {
        if (!project) return NextResponse.json({ error: "project required" }, { status: 400 });
        return NextResponse.json(await listIssues(project, query, limit));
      }
      case "issue": {
        if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });
        return NextResponse.json(await getIssue(issueId));
      }
      case "events": {
        if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });
        return NextResponse.json(await listEvents(issueId, limit));
      }
      case "event": {
        if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
        if (!project) return NextResponse.json({ error: "project required" }, { status: 400 });
        return NextResponse.json(await getEvent(project, eventId));
      }
      case "releases":
        return NextResponse.json(await listReleases(project, limit));
    }
  } catch (err) {
    return NextResponse.json({ error: "Sentry API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    switch (data.action) {
      case "resolve":
        return NextResponse.json(await resolveIssue(data.issueId));
      case "assign":
        return NextResponse.json(await assignIssue(data.issueId, data.assignee));
    }
  } catch (err) {
    return NextResponse.json({ error: "Sentry API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
