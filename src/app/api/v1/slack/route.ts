import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listChannels, getChannelHistory, getThreadReplies,
  listDMs, getDMHistory, openDM,
  sendMessage, searchMessages,
  listUsers, getUserInfo, getUserByEmail,
  addReaction,
} from "@/lib/slack/client";

const getSchema = z.object({
  action: z.enum(["channels", "channel_history", "thread", "dms", "dm_history", "search", "users", "user"]).default("channels"),
  channelId: z.string().min(1).optional(),
  ts: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional().default(50),
  oldest: z.string().optional(),
  q: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), channelId: z.string().min(1), text: z.string().min(1), threadTs: z.string().optional() }),
  z.object({ action: z.literal("open_dm"), userId: z.string().min(1) }),
  z.object({ action: z.literal("react"), channelId: z.string().min(1), ts: z.string().min(1), emoji: z.string().min(1) }),
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
  const { action, channelId, ts, limit, oldest, q, userId, email } = parsed.data;

  try {
    switch (action) {
      case "channels":
        return NextResponse.json({ channels: await listChannels() });
      case "channel_history": {
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        return NextResponse.json({ messages: await getChannelHistory(channelId, limit, oldest ?? undefined) });
      }
      case "thread": {
        if (!channelId || !ts) return NextResponse.json({ error: "channelId and ts required" }, { status: 400 });
        return NextResponse.json({ messages: await getThreadReplies(channelId, ts, limit) });
      }
      case "dms":
        return NextResponse.json({ dms: await listDMs() });
      case "dm_history": {
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        return NextResponse.json({ messages: await getDMHistory(channelId, limit) });
      }
      case "search": {
        if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
        return NextResponse.json({ matches: await searchMessages(q, limit) });
      }
      case "users":
        return NextResponse.json({ users: await listUsers() });
      case "user": {
        if (email) return NextResponse.json(await getUserByEmail(email));
        if (!userId) return NextResponse.json({ error: "userId or email required" }, { status: 400 });
        return NextResponse.json(await getUserInfo(userId));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Slack API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
      case "send":
        return NextResponse.json(await sendMessage(data.channelId, data.text, data.threadTs));
      case "open_dm":
        return NextResponse.json(await openDM(data.userId));
      case "react":
        return NextResponse.json(await addReaction(data.channelId, data.ts, data.emoji));
    }
  } catch (err) {
    return NextResponse.json({ error: "Slack API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
