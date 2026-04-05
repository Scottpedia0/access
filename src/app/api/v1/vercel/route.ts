import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import { listProjects, getProject, listDeployments, getDeployment, getDeploymentBuildLogs, getRuntimeLogs, listDomains, getDomainConfig, listEnvVars, createEnvVar, listTeams } from "@/lib/vercel/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["projects", "project", "deployments", "deployment", "build_logs", "runtime_logs", "domains", "domain_config", "env", "teams"]).default("projects"),
  projectId: z.string().min(1).optional(),
  deploymentId: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const postSchema = z.object({
  action: z.enum(["create_env"]),
  projectId: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
  target: z.array(z.enum(["production", "preview", "development"])).optional(),
});

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
  const { action, projectId, deploymentId, domain, limit } = parsed.data;

  try {
    switch (action) {
      case "projects":
        return NextResponse.json(await listProjects(limit));
      case "project": {
        if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
        return NextResponse.json(await getProject(projectId));
      }
      case "deployments":
        return NextResponse.json(await listDeployments(projectId ?? undefined, limit));
      case "deployment": {
        if (!deploymentId) return NextResponse.json({ error: "deploymentId required" }, { status: 400 });
        return NextResponse.json(await getDeployment(deploymentId));
      }
      case "build_logs": {
        if (!deploymentId) return NextResponse.json({ error: "deploymentId required" }, { status: 400 });
        return NextResponse.json(await getDeploymentBuildLogs(deploymentId));
      }
      case "runtime_logs": {
        if (!deploymentId) return NextResponse.json({ error: "deploymentId required" }, { status: 400 });
        return NextResponse.json(await getRuntimeLogs(deploymentId));
      }
      case "domains":
        return NextResponse.json(await listDomains());
      case "domain_config": {
        if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
        return NextResponse.json(await getDomainConfig(domain));
      }
      case "env": {
        if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
        return NextResponse.json(await listEnvVars(projectId));
      }
      case "teams":
        return NextResponse.json(await listTeams());
    }
  } catch (err) {
    return NextResponse.json({ error: "Vercel API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
      case "create_env":
        return NextResponse.json(await createEnvVar(data.projectId, data.key, data.value, data.target));
    }
  } catch (err) {
    return NextResponse.json({ error: "Vercel API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
