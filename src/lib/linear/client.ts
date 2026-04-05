const BASE = "https://api.linear.app/graphql";

function headers() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error("LINEAR_API_KEY not set");
  return {
    Authorization: apiKey,
    "Content-Type": "application/json",
  };
}

async function gql<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API error ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`);
  }
  return json.data as T;
}

// -- Issues -------------------------------------------------------------------

export async function listIssues(q?: string, limit = 50) {
  const filter = q ? `, filter: { or: [{ title: { containsIgnoreCase: "${q}" } }, { description: { containsIgnoreCase: "${q}" } }] }` : "";
  return gql(`
    query {
      issues(first: ${limit}${filter}, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          description
          priority
          state { id name }
          assignee { id name email }
          team { id name key }
          createdAt
          updatedAt
          url
        }
      }
    }
  `);
}

export async function getIssue(id: string) {
  return gql(`
    query($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        priority
        state { id name }
        assignee { id name email }
        team { id name key }
        labels { nodes { id name color } }
        comments { nodes { id body user { name } createdAt } }
        createdAt
        updatedAt
        url
      }
    }
  `, { id });
}

// -- Teams --------------------------------------------------------------------

export async function listTeams() {
  return gql(`
    query {
      teams {
        nodes {
          id
          name
          key
          description
        }
      }
    }
  `);
}

// -- Projects -----------------------------------------------------------------

export async function listProjects() {
  return gql(`
    query {
      projects(first: 50, orderBy: updatedAt) {
        nodes {
          id
          name
          description
          state
          progress
          startDate
          targetDate
          url
        }
      }
    }
  `);
}

// -- Cycles -------------------------------------------------------------------

export async function listCycles() {
  return gql(`
    query {
      cycles(filter: { isActive: { eq: true } }) {
        nodes {
          id
          name
          number
          startsAt
          endsAt
          progress
          team { id name }
        }
      }
    }
  `);
}

// -- Mutations ----------------------------------------------------------------

export async function createIssue(
  teamId: string,
  title: string,
  description?: string,
  priority?: number,
  assigneeId?: string,
) {
  return gql(`
    mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
        }
      }
    }
  `, {
    input: {
      teamId,
      title,
      ...(description !== undefined ? { description } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
  });
}

export async function updateIssue(
  id: string,
  stateId?: string,
  priority?: number,
  assigneeId?: string,
  title?: string,
) {
  const input: Record<string, unknown> = {};
  if (stateId !== undefined) input.stateId = stateId;
  if (priority !== undefined) input.priority = priority;
  if (assigneeId !== undefined) input.assigneeId = assigneeId;
  if (title !== undefined) input.title = title;

  return gql(`
    mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          title
          state { id name }
          url
        }
      }
    }
  `, { id, input });
}

export async function addComment(issueId: string, body: string) {
  return gql(`
    mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment {
          id
          body
          createdAt
        }
      }
    }
  `, {
    input: { issueId, body },
  });
}
