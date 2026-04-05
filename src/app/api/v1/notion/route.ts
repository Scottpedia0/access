import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  search,
  getPage,
  createPage,
  updatePage,
  queryDatabase,
  getBlockChildren,
  appendBlocks,
} from "@/lib/notion/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["search", "page", "database", "block_children"]),
  q: z.string().optional(),
  pageId: z.string().min(1).optional(),
  databaseId: z.string().min(1).optional(),
  blockId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_page"),
    databaseId: z.string().min(1),
    properties: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("update_page"),
    pageId: z.string().min(1),
    properties: z.record(z.string(), z.unknown()),
  }),
  z.object({
    action: z.literal("append_blocks"),
    blockId: z.string().min(1),
    children: z.array(z.unknown()).min(1),
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
  const { action, q, pageId, databaseId, blockId, limit } = parsed.data;

  try {
    switch (action) {
      case "search": {
        if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
        return NextResponse.json(await search(q, limit));
      }
      case "page": {
        if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });
        return NextResponse.json(await getPage(pageId));
      }
      case "database": {
        if (!databaseId) return NextResponse.json({ error: "databaseId required" }, { status: 400 });
        return NextResponse.json(await queryDatabase(databaseId, limit));
      }
      case "block_children": {
        if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });
        return NextResponse.json(await getBlockChildren(blockId));
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Notion API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 },
    );
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
      case "create_page":
        return NextResponse.json(await createPage(data.databaseId, data.properties));
      case "update_page":
        return NextResponse.json(await updatePage(data.pageId, data.properties));
      case "append_blocks":
        return NextResponse.json(await appendBlocks(data.blockId, data.children));
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Notion API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 },
    );
  }
}
