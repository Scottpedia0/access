import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  search, getIssue, createIssue, transitionIssue, addComment,
  listProjects, listBoards, listSprints,
} from "@/lib/jira/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["search", "issue", "projects", "boards", "sprints"]).default("search"),
  jql: z.string().optional(),
  key: z.string().optional(),
  projectKey: z.string().optional(),
  boardId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(20),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_issue"),
    projectKey: z.string().min(1),
    summary: z.string().min(1),
    issueType: z.string().optional().default("Task"),
    description: z.string().optional(),
    assigneeId: z.string().optional(),
  }),
  z.object({
    action: z.literal("transition"),
    key: z.string().min(1),
    transitionId: z.string().min(1),
  }),
  z.object({
    action: z.literal("comment"),
    key: z.string().min(1),
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
  const { action, jql, key, projectKey, boardId, limit } = parsed.data;

  try {
    switch (action) {
      case "search": {
        if (!jql) return NextResponse.json({ error: "jql required" }, { status: 400 });
        return NextResponse.json(await search(jql, limit));
      }
      case "issue": {
        if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
        return NextResponse.json(await getIssue(key));
      }
      case "projects":
        return NextResponse.json(await listProjects());
      case "boards":
        return NextResponse.json(await listBoards(projectKey));
      case "sprints": {
        if (!boardId) return NextResponse.json({ error: "boardId required" }, { status: 400 });
        return NextResponse.json(await listSprints(boardId));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Jira API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
        return NextResponse.json(await createIssue(data.projectKey, data.summary, data.issueType, data.description, data.assigneeId));
      case "transition":
        return NextResponse.json(await transitionIssue(data.key, data.transitionId));
      case "comment":
        return NextResponse.json(await addComment(data.key, data.body));
    }
  } catch (err) {
    return NextResponse.json({ error: "Jira API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
