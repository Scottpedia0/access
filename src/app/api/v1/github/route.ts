import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listRepos, getRepo,
  listIssues, getIssue, createIssue, addComment,
  listPulls, getPull, createPull,
  listWorkflowRuns, listBranches,
} from "@/lib/github/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["repos", "repo", "issues", "issue", "pulls", "pull", "actions", "branches"]).default("repos"),
  owner: z.string().min(1).optional(),
  repo: z.string().min(1).optional(),
  q: z.string().optional(),
  state: z.string().optional(),
  number: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(30),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_issue"),
    owner: z.string().min(1),
    repo: z.string().min(1),
    title: z.string().min(1),
    body: z.string().optional(),
    labels: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("comment"),
    owner: z.string().min(1),
    repo: z.string().min(1),
    number: z.number().int().positive(),
    body: z.string().min(1),
  }),
  z.object({
    action: z.literal("create_pr"),
    owner: z.string().min(1),
    repo: z.string().min(1),
    title: z.string().min(1),
    head: z.string().min(1),
    base: z.string().min(1),
    body: z.string().optional(),
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
  const { action, owner, repo, q, state, number, limit } = parsed.data;

  try {
    switch (action) {
      case "repos":
        return NextResponse.json(await listRepos(q, limit));
      case "repo": {
        if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
        return NextResponse.json(await getRepo(owner, repo));
      }
      case "issues": {
        if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
        return NextResponse.json(await listIssues(owner, repo, state ?? "open", limit));
      }
      case "issue": {
        if (!owner || !repo || !number) return NextResponse.json({ error: "owner, repo, and number required" }, { status: 400 });
        return NextResponse.json(await getIssue(owner, repo, number));
      }
      case "pulls": {
        if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
        return NextResponse.json(await listPulls(owner, repo, state ?? "open", limit));
      }
      case "pull": {
        if (!owner || !repo || !number) return NextResponse.json({ error: "owner, repo, and number required" }, { status: 400 });
        return NextResponse.json(await getPull(owner, repo, number));
      }
      case "actions": {
        if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
        return NextResponse.json(await listWorkflowRuns(owner, repo, limit));
      }
      case "branches": {
        if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
        return NextResponse.json(await listBranches(owner, repo));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "GitHub API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
        return NextResponse.json(await createIssue(data.owner, data.repo, data.title, data.body, data.labels));
      case "comment":
        return NextResponse.json(await addComment(data.owner, data.repo, data.number, data.body));
      case "create_pr":
        return NextResponse.json(await createPull(data.owner, data.repo, data.title, data.head, data.base, data.body));
    }
  } catch (err) {
    return NextResponse.json({ error: "GitHub API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
