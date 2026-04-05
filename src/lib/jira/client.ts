function getConfig() {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl) throw new Error("JIRA_BASE_URL not set");
  if (!email) throw new Error("JIRA_EMAIL not set");
  if (!token) throw new Error("JIRA_API_TOKEN not set");
  return { baseUrl: baseUrl.replace(/\/+$/, ""), email, token };
}

function headers() {
  const { email, token } = getConfig();
  const basic = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function jiraRest(path: string, options: RequestInit = {}) {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/rest/api/3${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function jiraAgile(path: string, options: RequestInit = {}) {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/rest/agile/1.0${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira Agile API error ${res.status}: ${text}`);
  }
  return res.json();
}

// -- Search ----------------------------------------------------------------

export async function search(jql: string, limit = 20) {
  return jiraRest(`/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}`);
}

// -- Issues ----------------------------------------------------------------

export async function getIssue(key: string) {
  return jiraRest(`/issue/${encodeURIComponent(key)}`);
}

export async function createIssue(
  projectKey: string,
  summary: string,
  issueType = "Task",
  description?: string,
  assigneeId?: string,
) {
  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    issuetype: { name: issueType },
  };
  if (description) {
    fields.description = {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
    };
  }
  if (assigneeId) {
    fields.assignee = { accountId: assigneeId };
  }
  return jiraRest("/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

export async function transitionIssue(key: string, transitionId: string) {
  return jiraRest(`/issue/${encodeURIComponent(key)}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: transitionId } }),
  });
}

export async function addComment(key: string, body: string) {
  return jiraRest(`/issue/${encodeURIComponent(key)}/comment`, {
    method: "POST",
    body: JSON.stringify({
      body: {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
      },
    }),
  });
}

// -- Projects --------------------------------------------------------------

export async function listProjects() {
  return jiraRest("/project/search");
}

// -- Boards & Sprints (Agile) ----------------------------------------------

export async function listBoards(projectKey?: string) {
  const qs = projectKey ? `?projectKeyOrId=${encodeURIComponent(projectKey)}` : "";
  return jiraAgile(`/board${qs}`);
}

export async function listSprints(boardId: string) {
  return jiraAgile(`/board/${encodeURIComponent(boardId)}/sprint`);
}
