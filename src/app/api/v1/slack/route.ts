import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listChannels, getChannelHistory, getThreadReplies,
  listDMs, getDMHistory, openDM,
  sendMessage, searchMessages,
  listUsers, getUserInfo, getUserByEmail,
  addReaction,
} from "@/lib/slack/client";

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

  const action = request.nextUrl.searchParams.get("action") ?? "channels";
  const p = request.nextUrl.searchParams;

  try {
    switch (action) {
      case "channels":
        return NextResponse.json({ channels: await listChannels() });
      case "channel_history": {
        const channelId = p.get("channelId");
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        return NextResponse.json({ messages: await getChannelHistory(channelId, parseInt(p.get("limit") ?? "50", 10), p.get("oldest") ?? undefined) });
      }
      case "thread": {
        const channelId = p.get("channelId");
        const ts = p.get("ts");
        if (!channelId || !ts) return NextResponse.json({ error: "channelId and ts required" }, { status: 400 });
        return NextResponse.json({ messages: await getThreadReplies(channelId, ts, parseInt(p.get("limit") ?? "50", 10)) });
      }
      case "dms":
        return NextResponse.json({ dms: await listDMs() });
      case "dm_history": {
        const channelId = p.get("channelId");
        if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
        return NextResponse.json({ messages: await getDMHistory(channelId, parseInt(p.get("limit") ?? "50", 10)) });
      }
      case "search": {
        const query = p.get("q");
        if (!query) return NextResponse.json({ error: "q required" }, { status: 400 });
        return NextResponse.json({ matches: await searchMessages(query, parseInt(p.get("limit") ?? "20", 10)) });
      }
      case "users":
        return NextResponse.json({ users: await listUsers() });
      case "user": {
        const userId = p.get("userId");
        const email = p.get("email");
        if (email) return NextResponse.json(await getUserByEmail(email));
        if (!userId) return NextResponse.json({ error: "userId or email required" }, { status: 400 });
        return NextResponse.json(await getUserInfo(userId));
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Slack API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();

  try {
    switch (body.action) {
      case "send":
        return NextResponse.json(await sendMessage(body.channelId, body.text, body.threadTs));
      case "open_dm":
        return NextResponse.json(await openDM(body.userId));
      case "react":
        return NextResponse.json(await addReaction(body.channelId, body.ts, body.emoji));
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Slack API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
