import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listProjects, getProject,
  listIssues, getIssue, createIssue, addNoteToIssue,
  listMergeRequests, getMergeRequest, createMergeRequest,
  listPipelines, listBranches,
} from "@/lib/gitlab/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["projects", "project", "issues", "issue", "merge_requests", "merge_request", "pipelines", "branches"]).default("projects"),
  id: z.string().optional(),
  iid: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  state: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(20),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_issue"),
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    labels: z.string().optional(),
  }),
  z.object({
    action: z.literal("comment"),
    id: z.string().min(1),
    iid: z.number().int().positive(),
    body: z.string().min(1),
  }),
  z.object({
    action: z.literal("create_mr"),
    id: z.string().min(1),
    title: z.string().min(1),
    sourceBranch: z.string().min(1),
    targetBranch: z.string().min(1),
    description: z.string().optional(),
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
  const { action, id, iid, search, state, limit } = parsed.data;

  try {
    switch (action) {
      case "projects":
        return NextResponse.json(await listProjects(search, limit));
      case "project": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getProject(id));
      }
      case "issues": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await listIssues(id, state, limit));
      }
      case "issue": {
        if (!id || !iid) return NextResponse.json({ error: "id and iid required" }, { status: 400 });
        return NextResponse.json(await getIssue(id, iid));
      }
      case "merge_requests": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await listMergeRequests(id, state, limit));
      }
      case "merge_request": {
        if (!id || !iid) return NextResponse.json({ error: "id and iid required" }, { status: 400 });
        return NextResponse.json(await getMergeRequest(id, iid));
      }
      case "pipelines": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await listPipelines(id, limit));
      }
      case "branches": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await listBranches(id));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "GitLab API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
        return NextResponse.json(await createIssue(data.id, data.title, data.description, data.labels));
      case "comment":
        return NextResponse.json(await addNoteToIssue(data.id, data.iid, data.body));
      case "create_mr":
        return NextResponse.json(await createMergeRequest(data.id, data.title, data.sourceBranch, data.targetBranch, data.description));
    }
  } catch (err) {
    return NextResponse.json({ error: "GitLab API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
