const BASE = "https://sentry.io/api/0";

function getOrg() {
  const org = process.env.SENTRY_ORG;
  if (!org) throw new Error("SENTRY_ORG not set");
  return org;
}

function headers() {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) throw new Error("SENTRY_AUTH_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function sentry(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sentry API error ${res.status}: ${text}`);
  }
  return res.json();
}

// -- GET actions --------------------------------------------------------------

export async function listProjects() {
  return sentry(`/organizations/${getOrg()}/projects/`);
}

export async function listIssues(project: string, query?: string, limit = 25) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  params.set("limit", String(limit));
  return sentry(`/projects/${getOrg()}/${project}/issues/?${params}`);
}

export async function getIssue(issueId: string) {
  return sentry(`/issues/${issueId}/`);
}

export async function listEvents(issueId: string, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) });
  return sentry(`/issues/${issueId}/events/?${params}`);
}

export async function getEvent(project: string, eventId: string) {
  return sentry(`/projects/${getOrg()}/${project}/events/${eventId}/`);
}

export async function listReleases(project?: string, limit = 25) {
  const params = new URLSearchParams({ per_page: String(limit) });
  if (project) {
    return sentry(`/projects/${getOrg()}/${project}/releases/?${params}`);
  }
  return sentry(`/organizations/${getOrg()}/releases/?${params}`);
}

// -- POST actions -------------------------------------------------------------

export async function resolveIssue(issueId: string) {
  return sentry(`/issues/${issueId}/`, {
    method: "PUT",
    body: JSON.stringify({ status: "resolved" }),
  });
}

export async function assignIssue(issueId: string, assignee: string) {
  return sentry(`/issues/${issueId}/`, {
    method: "PUT",
    body: JSON.stringify({ assignedTo: assignee }),
  });
}
