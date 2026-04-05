const BASE = "https://api.vercel.com";

function headers() {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) throw new Error("VERCEL_API_TOKEN not set");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function vc(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function listProjects(limit = 20) {
  return vc(`/v9/projects?limit=${limit}`);
}

export async function getProject(projectId: string) {
  return vc(`/v9/projects/${projectId}`);
}

// ── Deployments ───────────────────────────────────────────────────────────────

export async function listDeployments(projectId?: string, limit = 10) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (projectId) params.set("projectId", projectId);
  return vc(`/v6/deployments?${params}`);
}

export async function getDeployment(deploymentId: string) {
  return vc(`/v13/deployments/${deploymentId}`);
}

export async function getDeploymentBuildLogs(deploymentId: string) {
  return vc(`/v2/deployments/${deploymentId}/events`);
}

export async function getRuntimeLogs(deploymentId: string) {
  return vc(`/v1/deployments/${deploymentId}/events?follow=0&limit=100`);
}

// ── Domains ───────────────────────────────────────────────────────────────────

export async function listDomains(limit = 20) {
  return vc(`/v5/domains?limit=${limit}`);
}

export async function getDomainConfig(domain: string) {
  return vc(`/v6/domains/${domain}/config`);
}

// ── Environment Variables ─────────────────────────────────────────────────────

export async function listEnvVars(projectId: string) {
  return vc(`/v9/projects/${projectId}/env`);
}

export async function createEnvVar(projectId: string, key: string, value: string, target: string[] = ["production", "preview", "development"]) {
  return vc(`/v10/projects/${projectId}/env`, {
    method: "POST",
    body: JSON.stringify({ key, value, target, type: "encrypted" }),
  });
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function listTeams() {
  return vc("/v2/teams");
}
