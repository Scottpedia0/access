const BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function headers() {
  const token = process.env.NOTION_API_KEY;
  if (!token) throw new Error("NOTION_API_KEY not set");
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notion(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }
  return res.json();
}

// -- Search ----------------------------------------------------------------

export async function search(query: string, limit = 20) {
  return notion("/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      page_size: Math.min(limit, 100),
    }),
  });
}

// -- Pages -----------------------------------------------------------------

export async function getPage(pageId: string) {
  return notion(`/pages/${pageId}`);
}

export async function createPage(
  databaseId: string,
  properties: Record<string, unknown>,
) {
  return notion("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });
}

export async function updatePage(
  pageId: string,
  properties: Record<string, unknown>,
) {
  return notion(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

// -- Databases -------------------------------------------------------------

export async function queryDatabase(databaseId: string, limit = 20) {
  return notion(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: Math.min(limit, 100),
    }),
  });
}

// -- Blocks ----------------------------------------------------------------

export async function getBlockChildren(blockId: string) {
  return notion(`/blocks/${blockId}/children?page_size=100`);
}

export async function appendBlocks(
  blockId: string,
  children: unknown[],
) {
  return notion(`/blocks/${blockId}/children`, {
    method: "PATCH",
    body: JSON.stringify({ children }),
  });
}
