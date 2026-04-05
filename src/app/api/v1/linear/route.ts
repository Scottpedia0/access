import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listIssues, getIssue, createIssue, updateIssue, addComment,
  listTeams, listProjects, listCycles,
} from "@/lib/linear/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["issues", "issue", "teams", "projects", "cycles"]).default("issues"),
  id: z.string().min(1).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_issue"),
    teamId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    assigneeId: z.string().optional(),
  }),
  z.object({
    action: z.literal("update_issue"),
    id: z.string().min(1),
    stateId: z.string().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    assigneeId: z.string().optional(),
    title: z.string().optional(),
  }),
  z.object({
    action: z.literal("comment"),
    issueId: z.string().min(1),
    body: z.string().min(1),
  }),
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
  const { action, id, q, limit } = parsed.data;

  try {
    switch (action) {
      case "issues":
        return NextResponse.json(await listIssues(q, limit));
      case "issue": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getIssue(id));
      }
      case "teams":
        return NextResponse.json(await listTeams());
      case "projects":
        return NextResponse.json(await listProjects());
      case "cycles":
        return NextResponse.json(await listCycles());
    }
  } catch (err) {
    return NextResponse.json({ error: "Linear API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
      case "create_issue":
        return NextResponse.json(await createIssue(data.teamId, data.title, data.description, data.priority, data.assigneeId));
      case "update_issue":
        return NextResponse.json(await updateIssue(data.id, data.stateId, data.priority, data.assigneeId, data.title));
      case "comment":
        return NextResponse.json(await addComment(data.issueId, data.body));
    }
  } catch (err) {
    return NextResponse.json({ error: "Linear API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
