import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import { listProjects, getProject, listDeployments, getDeployment, getDeploymentBuildLogs, getRuntimeLogs, listDomains, getDomainConfig, listEnvVars, createEnvVar, listTeams } from "@/lib/vercel/client";

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

  const p = request.nextUrl.searchParams;
  const action = p.get("action") ?? "projects";

  try {
    switch (action) {
      case "projects":
        return NextResponse.json(await listProjects(parseInt(p.get("limit") ?? "20", 10)));
      case "project":
        return NextResponse.json(await getProject(p.get("projectId")!));
      case "deployments":
        return NextResponse.json(await listDeployments(p.get("projectId") ?? undefined, parseInt(p.get("limit") ?? "10", 10)));
      case "deployment":
        return NextResponse.json(await getDeployment(p.get("deploymentId")!));
      case "build_logs":
        return NextResponse.json(await getDeploymentBuildLogs(p.get("deploymentId")!));
      case "runtime_logs":
        return NextResponse.json(await getRuntimeLogs(p.get("deploymentId")!));
      case "domains":
        return NextResponse.json(await listDomains());
      case "domain_config":
        return NextResponse.json(await getDomainConfig(p.get("domain")!));
      case "env":
        return NextResponse.json(await listEnvVars(p.get("projectId")!));
      case "teams":
        return NextResponse.json(await listTeams());
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Vercel API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();

  try {
    switch (body.action) {
      case "create_env":
        return NextResponse.json(await createEnvVar(body.projectId, body.key, body.value, body.target));
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Vercel API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
