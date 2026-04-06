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

const AccountSchema = z.string().describe("Google account alias (e.g. 'go2', 'personal', 'moran') matching a key in the GOOGLE_ACCOUNTS env var");

const server = new McpServer({
  name: "access",
  version: "0.1.0",
});

// ── Profile ──────────────────────────────────────────────────────────────────

server.tool("google_profile_all", "List all configured Google accounts with their email addresses, display names, and OAuth scope status. Use this first to discover which account aliases are available and verify they have the scopes needed for other tools.", {}, async () => {
  const data = await api("/api/v1/google/profile");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Google Admin Reports ─────────────────────────────────────────────────────

server.tool("google_admin_login_activity", "Query Google Workspace Admin Reports API for activity events such as logins, admin actions, or OAuth token grants. Use this to audit user login history, detect suspicious access, or review admin changes. Defaults to login events.", {
  account: AccountSchema,
  userKey: z.string().default("all").describe("Email address of a specific user, or 'all' for all users"),
  applicationName: z.string().default("login").describe("Report application: 'login', 'admin', 'drive', 'calendar', 'token', etc."),
  max: z.number().int().min(1).max(1000).default(100).describe("Maximum number of activity records to return"),
  startTime: z.string().optional().describe("ISO 8601 start time filter, e.g. '2026-01-01T00:00:00Z'"),
  endTime: z.string().optional().describe("ISO 8601 end time filter, e.g. '2026-01-31T23:59:59Z'"),
  eventName: z.string().optional().describe("Specific event name to filter on, e.g. 'login_failure'"),
  filters: z.string().optional().describe("Admin Reports API filter expression, e.g. 'login_type==exchange'"),
  actorIpAddress: z.string().optional().describe("Filter events by the actor's IP address"),
  customerId: z.string().optional().describe("Google Workspace customer ID to scope the query"),
  orgUnitId: z.string().optional().describe("Organizational unit ID to scope the query"),
  groupIdFilter: z.string().optional().describe("Group ID to filter events by group membership"),
  pageToken: z.string().optional().describe("Pagination token from a previous response to fetch the next page"),
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

server.tool("google_admin_usage_report", "Fetch Google Workspace daily usage statistics (storage, app usage, account activity) for a specific user or all users on a given date. Use this for capacity planning or tracking adoption metrics.", {
  account: AccountSchema,
  date: z.string().describe("Report date in YYYY-MM-DD format (data is available ~2 days after)"),
  userKey: z.string().default("all").describe("Email address of a specific user, or 'all' for all users"),
  max: z.number().int().min(1).max(1000).default(100).describe("Maximum number of usage records to return"),
  parameters: z.string().optional().describe("Comma-separated usage parameters to include, e.g. 'accounts:last_login_time,drive:num_owned_items_total'"),
  pageToken: z.string().optional().describe("Pagination token from a previous response to fetch the next page"),
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

server.tool("gmail_search", "Search Gmail messages using Gmail query syntax. Use this to find emails by sender, subject, label, date, or read status. Returns message IDs, subjects, snippets, and thread IDs for use with gmail_thread.", {
  account: AccountSchema,
  query: z.string().describe("Gmail search query, e.g. 'from:someone@example.com is:unread', 'subject:invoice after:2026/01/01', 'label:important'"),
  max: z.number().int().min(1).max(50).default(10).describe("Maximum number of messages to return"),
}, async ({ account, query, max }) => {
  const data = await api(`/api/v1/google/gmail?account=${account}&action=search&q=${encodeURIComponent(query)}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_thread", "Retrieve all messages in a Gmail conversation thread. Use this after gmail_search to read the full email chain including all replies. Returns sender, recipients, subject, body, and timestamps for each message.", {
  account: AccountSchema,
  threadId: z.string().describe("Gmail thread ID from gmail_search results"),
}, async ({ account, threadId }) => {
  const data = await api(`/api/v1/google/gmail?account=${account}&action=thread&threadId=${threadId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_send", "Send an email from a configured Google account. Supports new messages and replies. Side effect: delivers the email immediately upon success. Returns the sent message ID.", {
  account: AccountSchema,
  to: z.string().describe("Recipient email address(es), comma-separated for multiple"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content — plain text or HTML"),
  cc: z.string().optional().describe("CC recipient email address(es), comma-separated"),
  bcc: z.string().optional().describe("BCC recipient email address(es), comma-separated"),
  inReplyTo: z.string().optional().describe("RFC 2822 Message-ID header of the message being replied to"),
  threadId: z.string().optional().describe("Gmail thread ID to keep the reply in the same conversation"),
}, async ({ account, to, subject, body, cc, bcc, inReplyTo, threadId }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "send", account, to, subject, body, cc, bcc, inReplyTo, threadId }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_trash", "Move a single Gmail message to trash. The message can be recovered from trash for 30 days. Use gmail_batch_trash for bulk operations.", {
  account: AccountSchema,
  messageId: z.string().describe("Gmail message ID from gmail_search or gmail_thread results"),
}, async ({ account, messageId }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "trash", account, messageId }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_batch_trash", "Move multiple Gmail messages to trash in a single call (up to 50). Use after gmail_search to bulk-clean spam or old notifications. Returns a count of successfully trashed vs failed messages.", {
  account: AccountSchema,
  messageIds: z.array(z.string()).min(1).max(50).describe("Array of Gmail message IDs to trash, obtained from gmail_search results"),
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

server.tool("gmail_modify_labels", "Add or remove Gmail labels on a message. Use this to mark messages as read (remove 'UNREAD'), star them (add 'STARRED'), archive (remove 'INBOX'), or apply custom labels. Returns the updated label list.", {
  account: AccountSchema,
  messageId: z.string().describe("Gmail message ID from gmail_search or gmail_thread results"),
  addLabelIds: z.array(z.string()).default([]).describe("Label IDs to add, e.g. ['STARRED', 'IMPORTANT'] or custom label IDs"),
  removeLabelIds: z.array(z.string()).default([]).describe("Label IDs to remove, e.g. ['UNREAD', 'INBOX']"),
}, async ({ account, messageId, addLabelIds, removeLabelIds }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "modify_labels", account, messageId, addLabelIds, removeLabelIds }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gmail_draft", "Create a Gmail draft without sending it. Use this when a message needs review before sending, or to stage a reply. The draft appears in the user's Drafts folder. Returns the draft ID.", {
  account: AccountSchema,
  to: z.string().describe("Recipient email address(es), comma-separated for multiple"),
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body content — plain text or HTML"),
  cc: z.string().optional().describe("CC recipient email address(es), comma-separated"),
  inReplyTo: z.string().optional().describe("RFC 2822 Message-ID header of the message being replied to"),
  threadId: z.string().optional().describe("Gmail thread ID to keep the draft in the same conversation"),
}, async ({ account, to, subject, body, cc, inReplyTo, threadId }) => {
  const data = await api("/api/v1/google/gmail", {
    method: "POST",
    body: JSON.stringify({ action: "draft", account, to, subject, body, cc, inReplyTo, threadId }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Calendar ──────────────────────────────────────────────────────────────────

server.tool("calendar_list_events", "List upcoming Google Calendar events for a configured account, ordered by start time. Use this to check schedules, find meeting conflicts, or get today's agenda. Returns event titles, times, attendees, and meeting links.", {
  account: AccountSchema,
  max: z.number().int().min(1).max(50).default(10).describe("Maximum number of events to return"),
  timeMin: z.string().optional().describe("ISO 8601 start time to filter from, defaults to now. E.g. '2026-04-05T00:00:00Z'"),
}, async ({ account, max, timeMin }) => {
  const params = new URLSearchParams({ account, action: "list", max: String(max) });
  if (timeMin) params.set("timeMin", timeMin);
  const data = await api(`/api/v1/google/calendar?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Drive ─────────────────────────────────────────────────────────────────────

server.tool("drive_search", "Search Google Drive files using the Drive API query syntax. Use this to find documents, spreadsheets, or any file by name, type, or content. Returns file IDs, names, MIME types, and modification dates.", {
  account: AccountSchema,
  query: z.string().describe("Drive API query, e.g. \"name contains 'budget'\", \"mimeType='application/vnd.google-apps.spreadsheet'\", or combine with 'and'"),
  max: z.number().int().min(1).max(50).default(20).describe("Maximum number of files to return"),
}, async ({ account, query, max }) => {
  const data = await api(`/api/v1/google/drive?account=${account}&action=search&q=${encodeURIComponent(query)}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("drive_list", "List files and subfolders inside a specific Google Drive folder. Defaults to the root folder. Use drive_search to find a folder ID first, then this tool to browse its contents.", {
  account: AccountSchema,
  folderId: z.string().default("root").describe("Drive folder ID to list contents of, or 'root' for the top-level My Drive"),
  max: z.number().int().min(1).max(100).default(50).describe("Maximum number of files to return"),
}, async ({ account, folderId, max }) => {
  const data = await api(`/api/v1/google/drive?account=${account}&action=list&folderId=${folderId}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("drive_read_doc", "Export a Google Drive file (Doc, Sheet, Slide, etc.) to a specified format and return its content. Defaults to plain text export. Use this to read document contents without opening the Google editor.", {
  account: AccountSchema,
  fileId: z.string().describe("Google Drive file ID from drive_search or drive_list results"),
  mimeType: z.string().default("text/plain").describe("Export MIME type: 'text/plain', 'text/html', 'application/pdf', 'text/csv'"),
}, async ({ account, fileId, mimeType }) => {
  const data = await api(`/api/v1/google/drive?account=${account}&action=export&fileId=${fileId}&mimeType=${encodeURIComponent(mimeType)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Sheets ────────────────────────────────────────────────────────────────────

server.tool("sheets_read", "Read cell values from a Google Sheets spreadsheet using A1 notation. Returns a 2D array of values. Use this to inspect data, headers, or specific ranges before appending.", {
  account: AccountSchema,
  spreadsheetId: z.string().describe("Google Sheets spreadsheet ID from the URL (the long string between /d/ and /edit)"),
  range: z.string().default("Sheet1").describe("Sheet name or A1 notation range, e.g. 'Sheet1', 'Sheet1!A1:D10', 'Sheet1!A:A'"),
}, async ({ account, spreadsheetId, range }) => {
  const data = await api(`/api/v1/google/sheets?account=${account}&action=read&spreadsheetId=${spreadsheetId}&range=${encodeURIComponent(range)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("sheets_append", "Append one or more rows to the bottom of a Google Sheets spreadsheet. New rows are added after the last row with data. Side effect: modifies the spreadsheet immediately.", {
  account: AccountSchema,
  spreadsheetId: z.string().describe("Google Sheets spreadsheet ID from the URL (the long string between /d/ and /edit)"),
  range: z.string().default("Sheet1").describe("Target sheet name or range, e.g. 'Sheet1' or 'Sheet1!A:D'"),
  values: z.array(z.array(z.unknown())).describe("2D array of row data to append, e.g. [['Name', 'Email'], ['Alice', 'alice@example.com']]"),
}, async ({ account, spreadsheetId, range, values }) => {
  const data = await api("/api/v1/google/sheets", {
    method: "POST",
    body: JSON.stringify({ action: "append", account, spreadsheetId, range, values }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Docs ──────────────────────────────────────────────────────────────────────

server.tool("docs_read", "Read the full text content of a Google Doc. Returns the document body as plain text. Use this for quick content extraction without formatting.", {
  account: AccountSchema,
  documentId: z.string().describe("Google Docs document ID from the URL (the long string between /d/ and /edit)"),
}, async ({ account, documentId }) => {
  const data = await api(`/api/v1/google/docs?account=${account}&action=text&documentId=${documentId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Contacts ──────────────────────────────────────────────────────────────────

server.tool("contacts_search", "Search Google Contacts by name, email address, or phone number. Returns matching contacts with their full names, emails, phone numbers, and organizations.", {
  account: AccountSchema,
  query: z.string().describe("Search term — a name, email address, or phone number to match against"),
  max: z.number().int().min(1).max(50).default(10).describe("Maximum number of contacts to return"),
}, async ({ account, query, max }) => {
  const data = await api(`/api/v1/google/contacts?account=${account}&action=search&q=${encodeURIComponent(query)}&max=${max}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Cal.com ───────────────────────────────────────────────────────────────────

server.tool("cal_list_bookings", "List Cal.com bookings filtered by status. Use this to see scheduled meetings, check past calls, or find cancelled bookings. Returns booking details including attendee info, event type, and timestamps.", {
  status: z.enum(["upcoming", "past", "cancelled", "all"]).optional().describe("Filter bookings by status. Omit to return all statuses."),
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of bookings to return"),
}, async ({ status, limit }) => {
  const params = new URLSearchParams({ action: "bookings", limit: String(limit) });
  if (status) params.set("status", status);
  const data = await api(`/api/v1/cal?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cal_get_booking", "Retrieve full details of a single Cal.com booking including attendees, notes, responses, and meeting link. Use after cal_list_bookings to get complete info on a specific booking.", {
  bookingId: z.number().int().describe("Numeric Cal.com booking ID from cal_list_bookings results"),
}, async ({ bookingId }) => {
  const data = await api(`/api/v1/cal?action=booking&bookingId=${bookingId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cal_cancel_booking", "Cancel a Cal.com booking and notify the attendee. Side effect: sends a cancellation email to all participants. This action cannot be undone.", {
  bookingId: z.number().int().describe("Numeric Cal.com booking ID to cancel"),
  reason: z.string().optional().describe("Cancellation reason shown to the attendee in the notification email"),
}, async ({ bookingId, reason }) => {
  const data = await api("/api/v1/cal", {
    method: "POST",
    body: JSON.stringify({ action: "cancel", bookingId, reason }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cal_event_types", "List all Cal.com event types with their slugs, durations, and scheduling URLs. Use this to see which booking pages are available and their configuration.", {}, async () => {
  const data = await api("/api/v1/cal?action=event-types");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Porkbun ───────────────────────────────────────────────────────────────────

server.tool("porkbun_domains", "List all domains registered in the Porkbun account with their expiration dates and auto-renew status. Use this to audit domain ownership or find a specific domain.", {}, async () => {
  const data = await api("/api/v1/porkbun?action=domains");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("porkbun_dns", "List all DNS records (A, AAAA, CNAME, MX, TXT, NS) for a domain managed in Porkbun. Use this to audit DNS configuration or find existing records before creating new ones.", {
  domain: z.string().describe("Domain name, e.g. 'go2.io' or 'moran.bot'"),
}, async ({ domain }) => {
  const data = await api(`/api/v1/porkbun?action=dns&domain=${domain}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("porkbun_check_domain", "Check domain name availability and registration price on Porkbun. Returns whether the domain is available and the cost to register it.", {
  domain: z.string().describe("Full domain name to check, e.g. 'example.com' or 'mybrand.io'"),
}, async ({ domain }) => {
  const data = await api(`/api/v1/porkbun?action=check&domain=${domain}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("porkbun_create_dns", "Create a new DNS record on a Porkbun-managed domain. Side effect: the record is live immediately after creation. Use porkbun_dns first to check for conflicts.", {
  domain: z.string().describe("Domain name, e.g. 'go2.io'"),
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]).describe("DNS record type"),
  name: z.string().default("").describe("Subdomain prefix (e.g. 'www', 'api'), or empty string for the root domain"),
  content: z.string().describe("Record value — IP address for A/AAAA, hostname for CNAME/MX, text for TXT"),
  ttl: z.string().default("600").describe("Time-to-live in seconds, default 600"),
}, async ({ domain, type, name, content, ttl }) => {
  const data = await api("/api/v1/porkbun", { method: "POST", body: JSON.stringify({ action: "create_dns", domain, record: { type, name, content, ttl } }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Google Tag Manager ────────────────────────────────────────────────────────

server.tool("gtm_accounts", "List all Google Tag Manager accounts accessible by the specified Google account. Use this first to get account IDs needed by gtm_containers and gtm_tags.", {
  account: AccountSchema,
}, async ({ account }) => {
  const data = await api(`/api/v1/google/tag-manager?account=${account}&action=accounts`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gtm_containers", "List all GTM containers within a specific Tag Manager account. Returns container IDs, names, and website URLs. Use after gtm_accounts to drill down.", {
  account: AccountSchema,
  accountId: z.string().describe("GTM account ID from gtm_accounts results"),
}, async ({ account, accountId }) => {
  const data = await api(`/api/v1/google/tag-manager?account=${account}&action=containers&accountId=${accountId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("gtm_tags", "List all tags configured in a GTM container workspace, including their type, firing triggers, and status. Use this to audit tracking pixels, conversion tags, or analytics configuration.", {
  account: AccountSchema,
  accountId: z.string().describe("GTM account ID from gtm_accounts results"),
  containerId: z.string().describe("GTM container ID from gtm_containers results"),
  workspaceId: z.string().default("1").describe("Workspace ID, defaults to '1' (the default workspace)"),
}, async ({ account, accountId, containerId, workspaceId }) => {
  const data = await api(`/api/v1/google/tag-manager?account=${account}&action=tags&accountId=${accountId}&containerId=${containerId}&workspaceId=${workspaceId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Vercel ────────────────────────────────────────────────────────────────────

server.tool("vercel_projects", "List all Vercel projects in the account with their names, frameworks, and latest deployment status. Use this to get project IDs needed by vercel_deployments and vercel_env.", {
  limit: z.number().int().default(20).describe("Maximum number of projects to return"),
}, async ({ limit }) => {
  const data = await api(`/api/v1/vercel?action=projects&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_deployments", "List recent Vercel deployments with their status, URL, branch, and creation time. Optionally filter by project. Use this to check deployment status or find a deployment ID for vercel_build_logs.", {
  projectId: z.string().optional().describe("Vercel project ID to filter deployments. Omit to list across all projects."),
  limit: z.number().int().default(10).describe("Maximum number of deployments to return"),
}, async ({ projectId, limit }) => {
  const params = new URLSearchParams({ action: "deployments", limit: String(limit) });
  if (projectId) params.set("projectId", projectId);
  const data = await api(`/api/v1/vercel?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_build_logs", "Retrieve build output logs for a specific Vercel deployment. Use this to diagnose build failures or verify successful deployments. Returns timestamped log lines.", {
  deploymentId: z.string().describe("Vercel deployment ID from vercel_deployments results"),
}, async ({ deploymentId }) => {
  const data = await api(`/api/v1/vercel?action=build_logs&deploymentId=${deploymentId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_env", "List all environment variables configured for a Vercel project, grouped by target environment (production, preview, development). Returns variable names and targets but redacts secret values.", {
  projectId: z.string().describe("Vercel project ID from vercel_projects results"),
}, async ({ projectId }) => {
  const data = await api(`/api/v1/vercel?action=env&projectId=${projectId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("vercel_domains", "List all custom domains configured across Vercel projects, including their DNS verification status and associated project. Use this to audit domain assignments or check configuration.", {}, async () => {
  const data = await api("/api/v1/vercel?action=domains");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Cloudflare ────────────────────────────────────────────────────────────────

server.tool("cf_accounts", "List all Cloudflare accounts accessible with the configured API token. Use this first to get account IDs needed by cf_tunnels, cf_tunnel_config, and cf_workers.", {}, async () => {
  const data = await api("/api/v1/cloudflare?action=accounts");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_zones", "List all Cloudflare zones (domains) with their IDs, status, and name servers. Use this to get zone IDs needed by cf_dns and cf_create_dns.", {
  accountId: z.string().optional().describe("Cloudflare account ID to filter zones. Omit to list all accessible zones."),
}, async ({ accountId }) => {
  const params = accountId ? `?action=zones&accountId=${accountId}` : "?action=zones";
  const data = await api(`/api/v1/cloudflare${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_dns", "List all DNS records for a Cloudflare zone including type, name, content, TTL, and proxy status. Use this to audit DNS configuration or check for existing records before creating new ones.", {
  zoneId: z.string().describe("Cloudflare zone ID from cf_zones results"),
}, async ({ zoneId }) => {
  const data = await api(`/api/v1/cloudflare?action=dns&zoneId=${zoneId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_create_dns", "Create a new DNS record in a Cloudflare zone. Side effect: the record goes live immediately and can affect traffic routing. Use cf_dns first to check for conflicts.", {
  zoneId: z.string().describe("Cloudflare zone ID from cf_zones results"),
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"]).describe("DNS record type"),
  name: z.string().describe("Record name, e.g. 'www' or '@' for root"),
  content: z.string().describe("Record value, e.g. IP address or target hostname"),
  proxied: z.boolean().default(false),
  ttl: z.number().int().default(1).describe("TTL in seconds, 1 = automatic"),
}, async ({ zoneId, type, name, content, proxied, ttl }) => {
  const data = await api("/api/v1/cloudflare", { method: "POST", body: JSON.stringify({ action: "create_dns", zoneId, record: { type, name, content, proxied, ttl } }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_tunnels", "List all Cloudflare Tunnels in an account with their IDs, names, and connection status. Use this to find tunnel IDs for cf_tunnel_config.", {
  accountId: z.string().describe("Cloudflare account ID from cf_accounts results"),
}, async ({ accountId }) => {
  const data = await api(`/api/v1/cloudflare?action=tunnels&accountId=${accountId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_tunnel_config", "Retrieve the ingress routing configuration for a specific Cloudflare Tunnel, showing which hostnames map to which local services. Use this to debug tunnel routing or verify configuration.", {
  accountId: z.string().describe("Cloudflare account ID from cf_accounts results"),
  tunnelId: z.string().describe("Cloudflare Tunnel ID from cf_tunnels results"),
}, async ({ accountId, tunnelId }) => {
  const data = await api(`/api/v1/cloudflare?action=tunnel_config&accountId=${accountId}&tunnelId=${tunnelId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("cf_workers", "List all Cloudflare Workers scripts deployed in an account, including their names and last-modified timestamps. Use this to audit deployed serverless functions.", {
  accountId: z.string().describe("Cloudflare account ID from cf_accounts results"),
}, async ({ accountId }) => {
  const data = await api(`/api/v1/cloudflare?action=workers&accountId=${accountId}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Slack ─────────────────────────────────────────────────────────────────────

server.tool("slack_list_channels", "List all Slack channels (public and private) in the workspace with their IDs, names, topics, and member counts. Use this to find channel IDs needed by slack_channel_history and slack_send.", {
  limit: z.number().int().min(1).max(1000).default(200).describe("Maximum number of channels to return"),
}, async ({ limit }) => {
  const data = await api(`/api/v1/slack?action=channels&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_channel_history", "Read recent messages from a Slack channel in reverse chronological order. Returns message text, author, timestamp, and thread metadata. Use slack_thread to read replies.", {
  channelId: z.string().describe("Slack channel ID (starts with 'C'), from slack_list_channels results"),
  limit: z.number().int().min(1).max(200).default(50).describe("Maximum number of messages to return"),
  oldest: z.string().optional().describe("Unix timestamp — only return messages newer than this, e.g. '1714000000.000000'"),
}, async ({ channelId, limit, oldest }) => {
  const params = new URLSearchParams({ action: "channel_history", channelId, limit: String(limit) });
  if (oldest) params.set("oldest", oldest);
  const data = await api(`/api/v1/slack?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_thread", "Read all replies in a Slack thread including the parent message. Use this after slack_channel_history when a message has thread replies you need to read.", {
  channelId: z.string().describe("Slack channel ID where the thread exists"),
  ts: z.string().describe("Timestamp of the thread's parent message, e.g. '1714000000.000000'"),
  limit: z.number().int().min(1).max(200).default(50).describe("Maximum number of replies to return"),
}, async ({ channelId, ts, limit }) => {
  const data = await api(`/api/v1/slack?action=thread&channelId=${channelId}&ts=${ts}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_list_dms", "List all direct message and group DM conversations visible to the bot. Returns channel IDs and participant info. Use this to find DM channel IDs for slack_dm_history.", {}, async () => {
  const data = await api("/api/v1/slack?action=dms");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_dm_history", "Read recent messages from a Slack direct message or group DM conversation. Returns message text, author, and timestamps in reverse chronological order.", {
  channelId: z.string().describe("DM channel ID — starts with 'D' for 1:1 DMs or 'G' for group DMs, from slack_list_dms results"),
  limit: z.number().int().min(1).max(200).default(50).describe("Maximum number of messages to return"),
}, async ({ channelId, limit }) => {
  const data = await api(`/api/v1/slack?action=dm_history&channelId=${channelId}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_search", "Search Slack messages across all channels and DMs using Slack search syntax. Use this to find specific conversations, mentions, or topics. Returns matching messages with channel context and timestamps.", {
  query: z.string().describe("Slack search query — supports modifiers like 'from:@scott', 'in:#general', 'has:link', 'before:2026-01-01'"),
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of matching messages to return"),
}, async ({ query, limit }) => {
  const data = await api(`/api/v1/slack?action=search&q=${encodeURIComponent(query)}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_send", "Send a Slack message to a channel, DM, or thread. Side effect: delivers the message immediately and it is visible to all channel members. Supports Slack mrkdwn formatting.", {
  channelId: z.string().describe("Target channel ID, DM channel ID, or user ID (sending to a user ID opens a DM)"),
  text: z.string().describe("Message content — supports Slack mrkdwn formatting (*bold*, _italic_, `code`, etc.)"),
  threadTs: z.string().optional().describe("Parent message timestamp to reply in a thread, e.g. '1714000000.000000'"),
}, async ({ channelId, text, threadTs }) => {
  const data = await api("/api/v1/slack", { method: "POST", body: JSON.stringify({ action: "send", channelId, text, threadTs }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_users", "List all members of the Slack workspace with their user IDs, display names, emails, and online status. Use this to look up user IDs or find team members.", {}, async () => {
  const data = await api("/api/v1/slack?action=users");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("slack_find_user", "Look up a Slack user by their email address. Returns user ID, display name, and profile info. Use this when you have an email but need the Slack user ID for sending messages.", {
  email: z.string().describe("Email address to look up, e.g. 'scott@go2.io'"),
}, async ({ email }) => {
  const data = await api(`/api/v1/slack?action=user&email=${encodeURIComponent(email)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── HubSpot ───────────────────────────────────────────────────────────────────

server.tool("hubspot_search_contacts", "Search HubSpot CRM contacts by name, email, or company. Returns contact IDs, names, emails, and company associations. Use this to find contacts before viewing full details with hubspot_get_contact.", {
  query: z.string().describe("Search term — name, email address, or company name to match against"),
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of contacts to return"),
}, async ({ query, limit }) => {
  const data = await api(`/api/v1/hubspot?action=search_contacts&q=${encodeURIComponent(query)}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_get_contact", "Retrieve all properties and associations for a single HubSpot contact. Returns full profile data including custom properties, lifecycle stage, and associated deals/companies.", {
  id: z.string().describe("HubSpot contact ID from hubspot_search_contacts results"),
}, async ({ id }) => {
  const data = await api(`/api/v1/hubspot?action=get_contact&id=${id}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_create_contact", "Create a new contact in HubSpot CRM. Side effect: the contact is immediately created and may trigger workflows. Email is required; all other fields are optional.", {
  email: z.string().describe("Contact's email address (required, must be unique in HubSpot)"),
  firstname: z.string().optional().describe("Contact's first name"),
  lastname: z.string().optional().describe("Contact's last name"),
  company: z.string().optional().describe("Company name associated with the contact"),
  phone: z.string().optional().describe("Contact's phone number"),
  jobtitle: z.string().optional().describe("Contact's job title"),
  lifecyclestage: z.string().optional().describe("HubSpot lifecycle stage: 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'customer', etc."),
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

server.tool("hubspot_update_contact", "Update one or more properties on an existing HubSpot contact. Side effect: changes are saved immediately and may trigger workflows. Only provided properties are changed; others are left untouched.", {
  id: z.string().describe("HubSpot contact ID to update, from hubspot_search_contacts or hubspot_get_contact"),
  properties: z.record(z.string()).describe("Key-value pairs of properties to update, e.g. {\"lifecyclestage\": \"customer\", \"phone\": \"+1234567890\"}"),
}, async ({ id, properties }) => {
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "update_contact", id, properties }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_search_deals", "Search HubSpot CRM deals by name, stage, or pipeline. Returns deal IDs, names, amounts, stages, and close dates. Use this to find deals before creating notes or logging calls.", {
  query: z.string().describe("Search term — deal name, pipeline stage, or keyword to match against"),
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of deals to return"),
}, async ({ query, limit }) => {
  const data = await api(`/api/v1/hubspot?action=search_deals&q=${encodeURIComponent(query)}&limit=${limit}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_create_deal", "Create a new deal in HubSpot CRM. Side effect: the deal is immediately created in the specified pipeline. Use hubspot_pipelines first to get valid pipeline and stage IDs.", {
  dealname: z.string().describe("Name/title for the new deal"),
  amount: z.string().optional().describe("Deal value as a string, e.g. '5000'"),
  dealstage: z.string().optional().describe("Pipeline stage ID from hubspot_pipelines results"),
  pipeline: z.string().optional().describe("Pipeline ID from hubspot_pipelines results (defaults to the default pipeline)"),
  closedate: z.string().optional().describe("Expected close date in ISO format, e.g. '2026-06-01'"),
}, async ({ dealname, amount, dealstage, pipeline, closedate }) => {
  const properties: Record<string, string> = { dealname };
  if (amount) properties.amount = amount;
  if (dealstage) properties.dealstage = dealstage;
  if (pipeline) properties.pipeline = pipeline;
  if (closedate) properties.closedate = closedate;
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "create_deal", properties }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_create_note", "Create a note engagement on a HubSpot contact or deal. Side effect: the note is immediately visible on the contact/deal timeline. Provide at least one of contactId or dealId.", {
  body: z.string().describe("Note content — plain text or HTML. Appears on the contact/deal activity timeline."),
  contactId: z.string().optional().describe("HubSpot contact ID to attach the note to"),
  dealId: z.string().optional().describe("HubSpot deal ID to attach the note to"),
  ownerId: z.string().optional().describe("HubSpot owner ID to attribute the note to, from hubspot_owners results"),
}, async ({ body, contactId, dealId, ownerId }) => {
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "create_note", body, contactId, dealId, ownerId }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_log_call", "Log a completed phone call as an engagement on a HubSpot contact. Side effect: the call record appears on the contact's activity timeline with notes and duration.", {
  contactId: z.string().describe("HubSpot contact ID to log the call against"),
  body: z.string().describe("Call notes or summary — appears in the call engagement details"),
  durationMs: z.number().int().default(0).describe("Call duration in milliseconds, e.g. 900000 for 15 minutes"),
  ownerId: z.string().optional().describe("HubSpot owner ID who made the call, from hubspot_owners results"),
}, async ({ contactId, body, durationMs, ownerId }) => {
  const data = await api("/api/v1/hubspot", { method: "POST", body: JSON.stringify({ action: "log_call", contactId, body, durationMs, ownerId }) });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_owners", "List all HubSpot owners (team members) with their IDs, names, and email addresses. Use this to get owner IDs needed by hubspot_create_note and hubspot_log_call.", {}, async () => {
  const data = await api("/api/v1/hubspot?action=owners");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("hubspot_pipelines", "List all HubSpot deal pipelines with their stages, stage IDs, and display order. Use this to get valid pipeline and stage IDs before creating deals with hubspot_create_deal.", {}, async () => {
  const data = await api("/api/v1/hubspot?action=pipelines");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Search Console ────────────────────────────────────────────────────────────

server.tool("search_console_sites", "List all verified Google Search Console properties (websites) for a Google account. Returns site URLs needed by search_console_query and search_console_sitemaps.", {
  account: AccountSchema,
}, async ({ account }) => {
  const data = await api(`/api/v1/google/search-console?account=${account}&action=sites`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("search_console_query", "Query Google Search Console performance data including clicks, impressions, CTR, and average position. Use this for SEO analysis, tracking keyword rankings, or identifying top-performing pages.", {
  account: AccountSchema,
  siteUrl: z.string().describe("Verified property URL from search_console_sites, e.g. 'https://go2.io/' or 'sc-domain:go2.io'"),
  startDate: z.string().default("28daysAgo").describe("Start date — ISO format '2026-01-01' or relative '28daysAgo', '7daysAgo'"),
  endDate: z.string().default("today").describe("End date — ISO format '2026-01-31' or 'today'"),
  dimensions: z.string().default("query").describe("Comma-separated dimensions to group by: 'query', 'page', 'country', 'device', 'date'"),
  limit: z.number().int().min(1).max(1000).default(25).describe("Maximum number of rows to return"),
}, async ({ account, siteUrl, startDate, endDate, dimensions, limit }) => {
  const params = new URLSearchParams({ account, action: "query", siteUrl, startDate, endDate, dimensions, limit: String(limit) });
  const data = await api(`/api/v1/google/search-console?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("search_console_sitemaps", "List all submitted sitemaps for a Google Search Console property, including their status and error counts. Use this to verify sitemap indexing health.", {
  account: AccountSchema,
  siteUrl: z.string().describe("Verified property URL from search_console_sites, e.g. 'https://go2.io/'"),
}, async ({ account, siteUrl }) => {
  const data = await api(`/api/v1/google/search-console?account=${account}&action=sitemaps&siteUrl=${encodeURIComponent(siteUrl)}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("search_console_submit_sitemap", "Submit a sitemap URL to Google Search Console for crawling and indexing. Side effect: Google will begin processing the sitemap, which may take hours to days.", {
  account: AccountSchema,
  siteUrl: z.string().describe("Verified property URL from search_console_sites, e.g. 'https://go2.io/'"),
  feedpath: z.string().describe("Full URL of the sitemap to submit, e.g. 'https://go2.io/sitemap.xml'"),
}, async ({ account, siteUrl, feedpath }) => {
  const data = await api("/api/v1/google/search-console", {
    method: "POST",
    body: JSON.stringify({ action: "submit_sitemap", account, siteUrl, feedpath }),
  });
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Google Analytics ──────────────────────────────────────────────────────────

server.tool("analytics_properties", "List all Google Analytics 4 properties accessible by a Google account. Returns property IDs and names needed by analytics_report and analytics_realtime.", {
  account: AccountSchema,
}, async ({ account }) => {
  const data = await api(`/api/v1/google/analytics?account=${account}&action=properties`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("analytics_report", "Run a Google Analytics 4 report for a date range with configurable metrics and dimensions. Use this for traffic analysis, conversion tracking, or page performance. Returns tabular data rows.", {
  account: AccountSchema,
  propertyId: z.string().describe("GA4 property ID (numeric) from analytics_properties results, e.g. '123456789'"),
  metrics: z.string().default("sessions,activeUsers").describe("Comma-separated GA4 metrics, e.g. 'sessions,activeUsers,screenPageViews,conversions'"),
  dimensions: z.string().optional().describe("Comma-separated GA4 dimensions to group by, e.g. 'pagePath,sessionSource,date'"),
  startDate: z.string().default("28daysAgo").describe("Start date — ISO format '2026-01-01' or relative '28daysAgo', '7daysAgo'"),
  endDate: z.string().default("today").describe("End date — ISO format '2026-01-31' or 'today'"),
  limit: z.number().int().min(1).max(250).default(25).describe("Maximum number of data rows to return"),
}, async ({ account, propertyId, metrics, dimensions, startDate, endDate, limit }) => {
  const params = new URLSearchParams({ account, action: "report", propertyId, metrics, startDate, endDate, limit: String(limit) });
  if (dimensions) params.set("dimensions", dimensions);
  const data = await api(`/api/v1/google/analytics?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("analytics_realtime", "Get real-time active user data from Google Analytics 4. Shows currently active users on the site, optionally broken down by country, device, or page. Data reflects the last 30 minutes.", {
  account: AccountSchema,
  propertyId: z.string().describe("GA4 property ID (numeric) from analytics_properties results"),
  metrics: z.string().default("activeUsers").describe("Comma-separated real-time metrics, e.g. 'activeUsers,screenPageViews'"),
  dimensions: z.string().optional().describe("Comma-separated real-time dimensions, e.g. 'country,deviceCategory,unifiedScreenName'"),
}, async ({ account, propertyId, metrics, dimensions }) => {
  const params = new URLSearchParams({ account, action: "realtime", propertyId, metrics });
  if (dimensions) params.set("dimensions", dimensions);
  const data = await api(`/api/v1/google/analytics?${params}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
