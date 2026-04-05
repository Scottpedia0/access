#!/usr/bin/env node
/**
 * Access MCP Server
 * Exposes all Google account tools to agents via MCP stdio transport.
 * Run: node mcp-server.mjs
 * Config: GLOBAL_AGENT_TOKEN and ACCESS_BASE_URL env vars (or defaults)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.ACCESS_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.GLOBAL_AGENT_TOKEN;

if (!TOKEN) {
  console.error("WARNING: GLOBAL_AGENT_TOKEN not set. Server will start for tool discovery but API calls will fail.");
}

const headers = TOKEN
  ? { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" }
  : { "Content-Type": "application/json" };

async function api(path, options = {}) {
  if (!TOKEN) {
    throw new Error("GLOBAL_AGENT_TOKEN is not configured. Set it in your environment to use Access tools.");
  }
  const res = await fetch(`${BASE_URL}${path}`, { headers, ...options });
  return res.json();
}

const AccountSchema = z.string().describe("Google account alias as configured in GOOGLE_ACCOUNTS env var");

const server = new McpServer({
  name: "access-vault",
  version: "1.0.0",
});

// ── Profile ──────────────────────────────────────────────────────────────────

server.tool("google_profile_all", "Get actual email + verification status for all 3 Google accounts (go2, personal, moran)", {}, async () => {
  const data = await api("/api/v1/google/profile");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Google Admin Reports ─────────────────────────────────────────────────────

server.tool("google_admin_login_activity", "List Google Workspace admin activity events, defaulting to login events", {
  account: AccountSchema,
  userKey: z.string().default("all"),
  applicationName: z.string().default("login"),
  max: z.number().int().min(1).max(1000).default(100),
  startTime: z.string().optional().describe("ISO8601 start time, e.g. 2026-01-01T00:00:00Z"),
  endTime: z.string().optional().describe("ISO8601 end time"),
  eventName: z.string().optional(),
  filters: z.string().optional().describe("Admin Reports API filters expression"),
  actorIpAddress: z.string().optional(),
  customerId: z.string().optional(),
  orgUnitId: z.string().optional(),
  groupIdFilter: z.string().optional(),
  pageToken: z.string().optional(),
}, async ({ account, userKey, applicationName, max, startTime, endTime, eventName, filters, actorIpAddress, customerId, orgUnitId, groupIdFilter, pageToken }) => {
  const params = new URLSearchParams({
    account,
    action: "activities",
    applicationName,
    userKey,
    max: String(max),
  });
  if (startTime) params.set("startTime", startTime);
  if (endTime) params.set("endTime", endTime);
  if (eventName) params.set("eventName", eventName);
  if (filters) params.set("filters", filters);
  if (actorIpAddress) params.set("actorIpAddress", actorIpAddress);
  if (customerId) params.set("customerId", customerId);
  if (orgUnitId) params.set("orgUnitId", orgUnitId);
  if (groupIdFilter) params.set("groupIdFilter", groupIdFilter);
  if (pageToken) params.set("pageToken", pageToken);
  const data = await api(`/api/v1/google/admin-reports?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("google_admin_usage_report", "Get Google Workspace daily usage reports for a user or all users", {
  account: AccountSchema,
  date: z.string().describe("Usage date in YYYY-MM-DD"),
  userKey: z.string().default("all"),
  max: z.number().int().min(1).max(1000).default(100),
  parameters: z.string().optional().describe("Comma-separated Admin Reports usage parameters"),
  pageToken: z.string().optional(),
}, async ({ account, date, userKey, max, parameters, pageToken }) => {
  const params = new URLSearchParams({
    account,
    action: "usage",
    date,
    userKey,
    max: String(max),
  });
  if (parameters) params.set("parameters", parameters);
  if (pageToken) params.set("pageToken", pageToken);
  const data = await api(`/api/v1/google/admin-reports?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Gmail ─────────────────────────────────────────────────────────────────────

server.tool("gmail_search", "Search Gmail inbox for any account", {
  account: AccountSchema,
  query: z.string().describe("Gmail search query, e.g. 'from:someone@example.com is:unread'"),
  max: z.number().int().min(1).max(50).default(10),
}, async ({ account, query, max }) => {
  const data = await api(`/api/v1/google/gmail?account=${account}&action=search&q=${encodeURIComponent(query)}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_thread", "Get a full Gmail thread by ID", {
  account: AccountSchema,
  threadId: z.string(),
}, async ({ account, threadId }) => {
  const data = await api(`/api/v1/google/gmail?account=${account}&action=thread&threadId=${threadId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_send", "Send an email from any account", {
  account: AccountSchema,
  to: z.string().describe("Recipient email address"),
  subject: z.string(),
  body: z.string().describe("Plain text or HTML body"),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  inReplyTo: z.string().optional().describe("Message-ID to reply to"),
  threadId: z.string().optional(),
}, async ({ account, to, subject, body, cc, bcc, inReplyTo, threadId }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "send", account, to, subject, body, cc, bcc, inReplyTo, threadId }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_trash", "Move a Gmail message to trash", {
  account: AccountSchema,
  messageId: z.string(),
}, async ({ account, messageId }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "trash", account, messageId }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_batch_trash", "Trash multiple Gmail messages at once (up to 50 IDs). Use after gmail_search to bulk-delete spam.", {
  account: AccountSchema,
  messageIds: z.array(z.string()).min(1).max(50),
}, async ({ account, messageIds }) => {
  const results = await Promise.allSettled(
    messageIds.map((messageId) =>
      api("/api/v1/google/gmail", {
        method: "POST",
        body: JSON.stringify({ action: "trash", account, messageId }),
      })
    )
  );
  const trashed = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { content: [{ type: "text", text: JSON.stringify({ trashed, failed }, null, 2) }] };
});

server.tool("gmail_modify_labels", "Add or remove labels on a Gmail message (e.g. mark read: removeLabelIds=['UNREAD'])", {
  account: AccountSchema,
  messageId: z.string(),
  addLabelIds: z.array(z.string()).default([]),
  removeLabelIds: z.array(z.string()).default([]),
}, async ({ account, messageId, addLabelIds, removeLabelIds }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "modify_labels", account, messageId, addLabelIds, removeLabelIds }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_draft", "Create a Gmail draft from any account", {
  account: AccountSchema,
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  cc: z.string().optional(),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
}, async ({ account, to, subject, body, cc, inReplyTo, threadId }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "draft", account, to, subject, body, cc, inReplyTo, threadId }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Calendar ──────────────────────────────────────────────────────────────────

server.tool("calendar_list_events", "List upcoming calendar events for any account", {
  account: AccountSchema,
  max: z.number().int().min(1).max(50).default(10),
  timeMin: z.string().optional().describe("ISO8601 start time, defaults to now"),
}, async ({ account, max, timeMin }) => {
  const params = new URLSearchParams({ account, action: "list", max: String(max) });
  if (timeMin) params.set("timeMin", timeMin);
  const data = await api(`/api/v1/google/calendar?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Drive ─────────────────────────────────────────────────────────────────────

server.tool("drive_search", "Search Google Drive files for any account", {
  account: AccountSchema,
  query: z.string().describe("Drive search query, e.g. 'name contains \"budget\" and mimeType=\"application/vnd.google-apps.spreadsheet\"'"),
  max: z.number().int().min(1).max(50).default(20),
}, async ({ account, query, max }) => {
  const data = await api(`/api/v1/google/drive?account=${account}&action=search&q=${encodeURIComponent(query)}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("drive_list", "List files in a Drive folder for any account", {
  account: AccountSchema,
  folderId: z.string().default("root"),
  max: z.number().int().min(1).max(100).default(50),
}, async ({ account, folderId, max }) => {
  const data = await api(`/api/v1/google/drive?account=${account}&action=list&folderId=${folderId}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("drive_read_doc", "Export a Google Doc or file as plain text", {
  account: AccountSchema,
  fileId: z.string(),
  mimeType: z.string().default("text/plain"),
}, async ({ account, fileId, mimeType }) => {
  const data = await api(`/api/v1/google/drive?account=${account}&action=export&fileId=${fileId}&mimeType=${encodeURIComponent(mimeType)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Sheets ────────────────────────────────────────────────────────────────────

server.tool("sheets_read", "Read a range from a Google Sheet", {
  account: AccountSchema,
  spreadsheetId: z.string(),
  range: z.string().default("Sheet1").describe("Sheet name or A1 notation range, e.g. 'Sheet1!A1:D10'"),
}, async ({ account, spreadsheetId, range }) => {
  const data = await api(`/api/v1/google/sheets?account=${account}&action=read&spreadsheetId=${spreadsheetId}&range=${encodeURIComponent(range)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("sheets_append", "Append rows to a Google Sheet", {
  account: AccountSchema,
  spreadsheetId: z.string(),
  range: z.string().default("Sheet1"),
  values: z.array(z.array(z.unknown())).describe("2D array of values to append"),
}, async ({ account, spreadsheetId, range, values }) => {
  const data = await api("/api/v1/google/sheets", {
    method: "POST",
    body: JSON.stringify({ action: "append", account, spreadsheetId, range, values }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Docs ──────────────────────────────────────────────────────────────────────

server.tool("docs_read", "Read a Google Doc as plain text", {
  account: AccountSchema,
  documentId: z.string(),
}, async ({ account, documentId }) => {
  const data = await api(`/api/v1/google/docs?account=${account}&action=text&documentId=${documentId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Contacts ──────────────────────────────────────────────────────────────────

server.tool("contacts_search", "Search Google Contacts for any account", {
  account: AccountSchema,
  query: z.string().describe("Name, email, or phone to search for"),
  max: z.number().int().min(1).max(50).default(10),
}, async ({ account, query, max }) => {
  const data = await api(`/api/v1/google/contacts?account=${account}&action=search&q=${encodeURIComponent(query)}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Cal.com ───────────────────────────────────────────────────────────────────

server.tool("cal_list_bookings", "List Cal.com bookings. Status: upcoming, past, cancelled, all", {
  status: z.enum(["upcoming", "past", "cancelled", "all"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
}, async ({ status, limit }) => {
  const params = new URLSearchParams({ action: "bookings", limit: String(limit) });
  if (status) params.set("status", status);
  const data = await api(`/api/v1/cal?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cal_get_booking", "Get a single Cal.com booking by ID", {
  bookingId: z.number().int(),
}, async ({ bookingId }) => {
  const data = await api(`/api/v1/cal?action=booking&bookingId=${bookingId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cal_cancel_booking", "Cancel a Cal.com booking", {
  bookingId: z.number().int(),
  reason: z.string().optional(),
}, async ({ bookingId, reason }) => {
  const data = await api("/api/v1/cal", {
    method: "POST",
    body: JSON.stringify({ action: "cancel", bookingId, reason }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cal_event_types", "List Cal.com event types (e.g. Workflow + AI Discovery Call)", {}, async () => {
  const data = await api("/api/v1/cal?action=event-types");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Porkbun ───────────────────────────────────────────────────────────────────

server.tool("porkbun_domains", "List all domains registered in Porkbun", {}, async () => {
  const data = await api("/api/v1/porkbun?action=domains");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("porkbun_dns", "List DNS records for a Porkbun domain", {
  domain: z.string().describe("e.g. 'go2.io'"),
}, async ({ domain }) => {
  const data = await api(`/api/v1/porkbun?action=dns&domain=${domain}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("porkbun_check_domain", "Check if a domain is available to register on Porkbun", {
  domain: z.string(),
}, async ({ domain }) => {
  const data = await api(`/api/v1/porkbun?action=check&domain=${domain}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("porkbun_create_dns", "Create a DNS record on a Porkbun domain", {
  domain: z.string(),
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
  name: z.string().default("").describe("Subdomain prefix, blank for root"),
  content: z.string(),
  ttl: z.string().default("600"),
}, async ({ domain, type, name, content, ttl }) => {
  const data = await api("/api/v1/porkbun", { method: "POST", body: JSON.stringify({ action: "create_dns", domain, record: { type, name, content, ttl } }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Google Tag Manager ────────────────────────────────────────────────────────

server.tool("gtm_accounts", "List Google Tag Manager accounts", {
  account: AccountSchema,
}, async ({ account }) => {
  const data = await api(`/api/v1/google/tag-manager?account=${account}&action=accounts`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gtm_containers", "List GTM containers in an account", {
  account: AccountSchema,
  accountId: z.string(),
}, async ({ account, accountId }) => {
  const data = await api(`/api/v1/google/tag-manager?account=${account}&action=containers&accountId=${accountId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gtm_tags", "List all tags in a GTM workspace", {
  account: AccountSchema,
  accountId: z.string(),
  containerId: z.string(),
  workspaceId: z.string().default("1"),
}, async ({ account, accountId, containerId, workspaceId }) => {
  const data = await api(`/api/v1/google/tag-manager?account=${account}&action=tags&accountId=${accountId}&containerId=${containerId}&workspaceId=${workspaceId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Vercel ────────────────────────────────────────────────────────────────────

server.tool("vercel_projects", "List all Vercel projects", {
  limit: z.number().int().default(20),
}, async ({ limit }) => {
  const data = await api(`/api/v1/vercel?action=projects&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_deployments", "List recent Vercel deployments", {
  projectId: z.string().optional(),
  limit: z.number().int().default(10),
}, async ({ projectId, limit }) => {
  const params = new URLSearchParams({ action: "deployments", limit: String(limit) });
  if (projectId) params.set("projectId", projectId);
  const data = await api(`/api/v1/vercel?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_build_logs", "Get build logs for a Vercel deployment", {
  deploymentId: z.string(),
}, async ({ deploymentId }) => {
  const data = await api(`/api/v1/vercel?action=build_logs&deploymentId=${deploymentId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_env", "List environment variables for a Vercel project", {
  projectId: z.string(),
}, async ({ projectId }) => {
  const data = await api(`/api/v1/vercel?action=env&projectId=${projectId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_domains", "List all domains configured in Vercel", {}, async () => {
  const data = await api("/api/v1/vercel?action=domains");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Cloudflare ────────────────────────────────────────────────────────────────

server.tool("cf_accounts", "List all Cloudflare accounts accessible with the API token", {}, async () => {
  const data = await api("/api/v1/cloudflare?action=accounts");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_zones", "List all Cloudflare zones (domains). Use this first to get zone IDs.", {
  accountId: z.string().optional(),
}, async ({ accountId }) => {
  const params = accountId ? `?action=zones&accountId=${accountId}` : "?action=zones";
  const data = await api(`/api/v1/cloudflare${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_dns", "List all DNS records for a Cloudflare zone", {
  zoneId: z.string(),
}, async ({ zoneId }) => {
  const data = await api(`/api/v1/cloudflare?action=dns&zoneId=${zoneId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_create_dns", "Create a DNS record in a Cloudflare zone", {
  zoneId: z.string(),
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"]),
  name: z.string().describe("Record name, e.g. 'www' or '@' for root"),
  content: z.string().describe("Record value, e.g. IP address or target hostname"),
  proxied: z.boolean().default(false),
  ttl: z.number().int().default(1).describe("TTL in seconds, 1 = automatic"),
}, async ({ zoneId, type, name, content, proxied, ttl }) => {
  const data = await api("/api/v1/cloudflare", { method: "POST", body: JSON.stringify({ action: "create_dns", zoneId, record: { type, name, content, proxied, ttl } }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_tunnels", "List all Cloudflare Tunnels", {
  accountId: z.string(),
}, async ({ accountId }) => {
  const data = await api(`/api/v1/cloudflare?action=tunnels&accountId=${accountId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_tunnel_config", "Get the ingress config for a specific Cloudflare Tunnel", {
  accountId: z.string(),
  tunnelId: z.string(),
}, async ({ accountId, tunnelId }) => {
  const data = await api(`/api/v1/cloudflare?action=tunnel_config&accountId=${accountId}&tunnelId=${tunnelId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_workers", "List all Cloudflare Workers in an account", {
  accountId: z.string(),
}, async ({ accountId }) => {
  const data = await api(`/api/v1/cloudflare?action=workers&accountId=${accountId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Slack ─────────────────────────────────────────────────────────────────────

server.tool("slack_list_channels", "List all Slack channels (public and private) in the workspace", {
  limit: z.number().int().min(1).max(1000).default(200),
}, async ({ limit }) => {
  const data = await api(`/api/v1/slack?action=channels&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_channel_history", "Read messages from a Slack channel", {
  channelId: z.string().describe("Slack channel ID (starts with C)"),
  limit: z.number().int().min(1).max(200).default(50),
  oldest: z.string().optional().describe("Unix timestamp — only return messages after this time"),
}, async ({ channelId, limit, oldest }) => {
  const params = new URLSearchParams({ action: "channel_history", channelId, limit: String(limit) });
  if (oldest) params.set("oldest", oldest);
  const data = await api(`/api/v1/slack?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_thread", "Read all replies in a Slack thread", {
  channelId: z.string(),
  ts: z.string().describe("Thread parent message timestamp"),
  limit: z.number().int().min(1).max(200).default(50),
}, async ({ channelId, ts, limit }) => {
  const data = await api(`/api/v1/slack?action=thread&channelId=${channelId}&ts=${ts}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_list_dms", "List all DM conversations the bot can see", {}, async () => {
  const data = await api("/api/v1/slack?action=dms");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_dm_history", "Read messages from a Slack DM or group DM", {
  channelId: z.string().describe("DM channel ID (starts with D for 1:1, G for group)"),
  limit: z.number().int().min(1).max(200).default(50),
}, async ({ channelId, limit }) => {
  const data = await api(`/api/v1/slack?action=dm_history&channelId=${channelId}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_search", "Search all Slack messages across channels and DMs", {
  query: z.string().describe("Search query — supports Slack search modifiers like 'from:@scott in:#general'"),
  limit: z.number().int().min(1).max(100).default(20),
}, async ({ query, limit }) => {
  const data = await api(`/api/v1/slack?action=search&q=${encodeURIComponent(query)}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_send", "Send a Slack message to any channel or DM", {
  channelId: z.string().describe("Channel ID, DM channel ID, or user ID"),
  text: z.string(),
  threadTs: z.string().optional().describe("Reply to a thread by passing the parent message timestamp"),
}, async ({ channelId, text, threadTs }) => {
  const data = await api("/api/v1/slack", { method: "POST", body: JSON.stringify({ action: "send", channelId, text, threadTs }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_users", "List all Slack workspace members", {}, async () => {
  const data = await api("/api/v1/slack?action=users");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_find_user", "Find a Slack user by email address", {
  email: z.string(),
}, async ({ email }) => {
  const data = await api(`/api/v1/slack?action=user&email=${encodeURIComponent(email)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── HubSpot ───────────────────────────────────────────────────────────────────

server.tool("hubspot_search_contacts", "Search HubSpot contacts by name, email, or company", {
  query: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
}, async ({ query, limit }) => {
  const data = await api(`/api/v1/hubspot?action=search_contacts&q=${encodeURIComponent(query)}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_get_contact", "Get a HubSpot contact by ID with full details", {
  id: z.string(),
}, async ({ id }) => {
  const data = await api(`/api/v1/hubspot?action=get_contact&id=${id}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_create_contact", "Create a new HubSpot contact", {
  email: z.string(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  jobtitle: z.string().optional(),
  lifecyclestage: z.string().optional().describe("e.g. 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'customer'"),
}, async ({ email, firstname, lastname, company, phone, jobtitle, lifecyclestage }) => {
  const properties: Record<string, string> = { email };
  if (firstname) properties.firstname = firstname;
  if (lastname) properties.lastname = lastname;
  if (company) properties.company = company;
  if (phone) properties.phone = phone;
  if (jobtitle) properties.jobtitle = jobtitle;
  if (lifecyclestage) properties.lifecyclestage = lifecyclestage;
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "create_contact", properties }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_update_contact", "Update a HubSpot contact's properties", {
  id: z.string(),
  properties: z.record(z.string()).describe("Key-value pairs of HubSpot contact properties to update"),
}, async ({ id, properties }) => {
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "update_contact", id, properties }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_search_deals", "Search HubSpot deals by name or stage", {
  query: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
}, async ({ query, limit }) => {
  const data = await api(`/api/v1/hubspot?action=search_deals&q=${encodeURIComponent(query)}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_create_deal", "Create a new HubSpot deal", {
  dealname: z.string(),
  amount: z.string().optional(),
  dealstage: z.string().optional().describe("Pipeline stage ID"),
  pipeline: z.string().optional().describe("Pipeline ID"),
  closedate: z.string().optional().describe("ISO date string"),
}, async ({ dealname, amount, dealstage, pipeline, closedate }) => {
  const properties: Record<string, string> = { dealname };
  if (amount) properties.amount = amount;
  if (dealstage) properties.dealstage = dealstage;
  if (pipeline) properties.pipeline = pipeline;
  if (closedate) properties.closedate = closedate;
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "create_deal", properties }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_create_note", "Log a note on a HubSpot contact or deal", {
  body: z.string().describe("Note content (plain text or HTML)"),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  ownerId: z.string().optional().describe("HubSpot owner ID to attribute the note to"),
}, async ({ body, contactId, dealId, ownerId }) => {
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "create_note", body, contactId, dealId, ownerId }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_log_call", "Log a completed call on a HubSpot contact", {
  contactId: z.string(),
  body: z.string().describe("Call notes / summary"),
  durationMs: z.number().int().default(0).describe("Call duration in milliseconds"),
  ownerId: z.string().optional(),
}, async ({ contactId, body, durationMs, ownerId }) => {
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "log_call", contactId, body, durationMs, ownerId }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_owners", "List all HubSpot owners (users) with their IDs and emails", {}, async () => {
  const data = await api("/api/v1/hubspot?action=owners");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_pipelines", "List HubSpot deal pipelines and their stages", {}, async () => {
  const data = await api("/api/v1/hubspot?action=pipelines");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Search Console ────────────────────────────────────────────────────────────

server.tool("search_console_sites", "List all Google Search Console properties for any account", {
  account: AccountSchema,
}, async ({ account }) => {
  const data = await api(`/api/v1/google/search-console?account=${account}&action=sites`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("search_console_query", "Query Google Search Console performance data (clicks, impressions, CTR, position)", {
  account: AccountSchema,
  siteUrl: z.string().describe("Full site URL, e.g. 'https://go2.io/' or 'sc-domain:go2.io'"),
  startDate: z.string().default("28daysAgo").describe("ISO date or relative, e.g. '2024-01-01' or '28daysAgo'"),
  endDate: z.string().default("today"),
  dimensions: z.string().default("query").describe("Comma-separated: query, page, country, device, date"),
  limit: z.number().int().min(1).max(1000).default(25),
}, async ({ account, siteUrl, startDate, endDate, dimensions, limit }) => {
  const params = new URLSearchParams({ account, action: "query", siteUrl, startDate, endDate, dimensions, limit: String(limit) });
  const data = await api(`/api/v1/google/search-console?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("search_console_sitemaps", "List sitemaps for a Search Console property", {
  account: AccountSchema,
  siteUrl: z.string(),
}, async ({ account, siteUrl }) => {
  const data = await api(`/api/v1/google/search-console?account=${account}&action=sitemaps&siteUrl=${encodeURIComponent(siteUrl)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("search_console_submit_sitemap", "Submit a sitemap URL to Google Search Console", {
  account: AccountSchema,
  siteUrl: z.string().describe("Verified property URL, e.g. 'https://go2.io/'"),
  feedpath: z.string().describe("Full sitemap URL, e.g. 'https://go2.io/sitemap.xml'"),
}, async ({ account, siteUrl, feedpath }) => {
  const data = await api("/api/v1/google/search-console", {
    method: "POST",
    body: JSON.stringify({ action: "submit_sitemap", account, siteUrl, feedpath }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Google Analytics ──────────────────────────────────────────────────────────

server.tool("analytics_properties", "List Google Analytics 4 properties for any account", {
  account: AccountSchema,
}, async ({ account }) => {
  const data = await api(`/api/v1/google/analytics?account=${account}&action=properties`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("analytics_report", "Run a GA4 report (sessions, users, pageviews, conversions, etc.)", {
  account: AccountSchema,
  propertyId: z.string().describe("GA4 property ID (numeric, e.g. '123456789')"),
  metrics: z.string().default("sessions,activeUsers").describe("Comma-separated GA4 metrics"),
  dimensions: z.string().optional().describe("Comma-separated GA4 dimensions, e.g. 'pagePath,sessionSource'"),
  startDate: z.string().default("28daysAgo"),
  endDate: z.string().default("today"),
  limit: z.number().int().min(1).max(250).default(25),
}, async ({ account, propertyId, metrics, dimensions, startDate, endDate, limit }) => {
  const params = new URLSearchParams({ account, action: "report", propertyId, metrics, startDate, endDate, limit: String(limit) });
  if (dimensions) params.set("dimensions", dimensions);
  const data = await api(`/api/v1/google/analytics?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("analytics_realtime", "Get real-time active users in GA4", {
  account: AccountSchema,
  propertyId: z.string(),
  metrics: z.string().default("activeUsers"),
  dimensions: z.string().optional().describe("e.g. 'country,deviceCategory'"),
}, async ({ account, propertyId, metrics, dimensions }) => {
  const params = new URLSearchParams({ account, action: "realtime", propertyId, metrics });
  if (dimensions) params.set("dimensions", dimensions);
  const data = await api(`/api/v1/google/analytics?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
