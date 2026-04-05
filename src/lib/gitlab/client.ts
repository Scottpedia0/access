function getConfig() {
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error("GITLAB_TOKEN not set");
  const baseUrl = (process.env.GITLAB_BASE_URL || "https://gitlab.com").replace(/\/+$/, "");
  return { baseUrl, token };
}

function headers() {
  const { token } = getConfig();
  return {
    "PRIVATE-TOKEN": token,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function gl(path: string, options: RequestInit = {}) {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/api/v4${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitLab API error ${res.status}: ${text}`);
  }
  return res.json();
}

function encId(id: string | number) {
  return encodeURIComponent(String(id));
}

// -- Projects --------------------------------------------------------------

export async function listProjects(search?: string, limit = 20) {
  const params = new URLSearchParams({ per_page: String(limit), membership: "true" });
  if (search) params.set("search", search);
  return gl(`/projects?${params}`);
}

export async function getProject(id: string | number) {
  return gl(`/projects/${encId(id)}`);
}

// -- Issues ----------------------------------------------------------------

export async function listIssues(id: string | number, state?: string, limit = 20) {
  const params = new URLSearchParams({ per_page: String(limit) });
  if (state) params.set("state", state);
  return gl(`/projects/${encId(id)}/issues?${params}`);
}

export async function getIssue(id: string | number, iid: number) {
  return gl(`/projects/${encId(id)}/issues/${iid}`);
}

export async function createIssue(id: string | number, title: string, description?: string, labels?: string) {
  const body: Record<string, unknown> = { title };
  if (description) body.description = description;
  if (labels) body.labels = labels;
  return gl(`/projects/${encId(id)}/issues`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function addNoteToIssue(id: string | number, iid: number, body: string) {
  return gl(`/projects/${encId(id)}/issues/${iid}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// -- Merge Requests --------------------------------------------------------

export async function listMergeRequests(id: string | number, state?: string, limit = 20) {
  const params = new URLSearchParams({ per_page: String(limit) });
  if (state) params.set("state", state);
  return gl(`/projects/${encId(id)}/merge_requests?${params}`);
}

export async function getMergeRequest(id: string | number, iid: number) {
  return gl(`/projects/${encId(id)}/merge_requests/${iid}`);
}

export async function createMergeRequest(
  id: string | number,
  title: string,
  sourceBranch: string,
  targetBranch: string,
  description?: string,
) {
  const body: Record<string, unknown> = {
    title,
    source_branch: sourceBranch,
    target_branch: targetBranch,
  };
  if (description) body.description = description;
  return gl(`/projects/${encId(id)}/merge_requests`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// -- Pipelines -------------------------------------------------------------

export async function listPipelines(id: string | number, limit = 20) {
  return gl(`/projects/${encId(id)}/pipelines?per_page=${limit}`);
}

// -- Branches --------------------------------------------------------------

export async function listBranches(id: string | number) {
  return gl(`/projects/${encId(id)}/repository/branches`);
}
