const BASE = "https://api.github.com";

function headers() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function gh(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

// -- Repos --------------------------------------------------------------------

export async function listRepos(q?: string, limit = 30) {
  if (q) {
    return gh(`/search/repositories?q=${encodeURIComponent(q)}+user:@me&per_page=${limit}`);
  }
  return gh(`/user/repos?sort=updated&per_page=${limit}`);
}

export async function getRepo(owner: string, repo: string) {
  return gh(`/repos/${owner}/${repo}`);
}

// -- Issues -------------------------------------------------------------------

export async function listIssues(owner: string, repo: string, state = "open", limit = 30) {
  return gh(`/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`);
}

export async function getIssue(owner: string, repo: string, number: number) {
  return gh(`/repos/${owner}/${repo}/issues/${number}`);
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
) {
  return gh(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function addComment(owner: string, repo: string, number: number, body: string) {
  return gh(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// -- Pull Requests ------------------------------------------------------------

export async function listPulls(owner: string, repo: string, state = "open", limit = 30) {
  return gh(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`);
}

export async function getPull(owner: string, repo: string, number: number) {
  return gh(`/repos/${owner}/${repo}/pulls/${number}`);
}

export async function createPull(
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string,
) {
  return gh(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, head, base, body }),
  });
}

// -- Actions ------------------------------------------------------------------

export async function listWorkflowRuns(owner: string, repo: string, limit = 20) {
  return gh(`/repos/${owner}/${repo}/actions/runs?per_page=${limit}`);
}

// -- Branches -----------------------------------------------------------------

export async function listBranches(owner: string, repo: string) {
  return gh(`/repos/${owner}/${repo}/branches?per_page=100`);
}
