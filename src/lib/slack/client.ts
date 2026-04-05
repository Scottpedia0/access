const BASE = "https://slack.com/api";

function token() {
  const t = process.env.SLACK_BOT_TOKEN;
  if (!t) throw new Error("SLACK_BOT_TOKEN not set");
  return t;
}

async function slack(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error (${method}): ${data.error}`);
  return data;
}

// ── Channels ──────────────────────────────────────────────────────────────────

export async function listChannels(types = "public_channel,private_channel", limit = 200) {
  const data = await slack("conversations.list", { types, limit, exclude_archived: true });
  return data.channels ?? [];
}

export async function getChannelHistory(channelId: string, limit = 50, oldest?: string) {
  const params: Record<string, unknown> = { channel: channelId, limit };
  if (oldest) params.oldest = oldest;
  const data = await slack("conversations.history", params);
  return data.messages ?? [];
}

export async function getThreadReplies(channelId: string, threadTs: string, limit = 50) {
  const data = await slack("conversations.replies", { channel: channelId, ts: threadTs, limit });
  return data.messages ?? [];
}

// ── DMs ───────────────────────────────────────────────────────────────────────

export async function listDMs(limit = 100) {
  const data = await slack("conversations.list", { types: "im,mpim", limit });
  return data.channels ?? [];
}

export async function getDMHistory(channelId: string, limit = 50) {
  const data = await slack("conversations.history", { channel: channelId, limit });
  return data.messages ?? [];
}

export async function openDM(userId: string) {
  const data = await slack("conversations.open", { users: userId });
  return data.channel;
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function sendMessage(channelId: string, text: string, threadTs?: string) {
  const params: Record<string, unknown> = { channel: channelId, text };
  if (threadTs) params.thread_ts = threadTs;
  const data = await slack("chat.postMessage", params);
  return { ts: data.ts, channel: data.channel };
}

export async function searchMessages(query: string, count = 20) {
  const data = await slack("search.messages", { query, count, sort: "timestamp" });
  return data.messages?.matches ?? [];
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function listUsers(limit = 200) {
  const data = await slack("users.list", { limit });
  return (data.members ?? []).filter((u: { deleted: boolean; is_bot: boolean }) => !u.deleted && !u.is_bot);
}

export async function getUserInfo(userId: string) {
  const data = await slack("users.info", { user: userId });
  return data.user;
}

export async function getUserByEmail(email: string) {
  const data = await slack("users.lookupByEmail", { email });
  return data.user;
}

// ── Reactions ─────────────────────────────────────────────────────────────────

export async function addReaction(channelId: string, ts: string, emoji: string) {
  await slack("reactions.add", { channel: channelId, timestamp: ts, name: emoji });
  return { ok: true };
}
