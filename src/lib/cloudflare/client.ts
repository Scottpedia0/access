const BASE = "https://api.cloudflare.com/client/v4";

function headers() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function cf(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  const data = await res.json() as { success: boolean; result: unknown; errors: { message: string }[] };
  if (!data.success) throw new Error(`Cloudflare API error: ${data.errors?.map((e) => e.message).join(", ")}`);
  return data.result;
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function listAccounts() {
  return cf("/accounts?per_page=50");
}

// ── Zones (Domains) ───────────────────────────────────────────────────────────

export async function listZones(accountId?: string) {
  const params = accountId ? `?account.id=${accountId}&per_page=50` : "?per_page=50";
  return cf(`/zones${params}`);
}

export async function getZone(zoneId: string) {
  return cf(`/zones/${zoneId}`);
}

// ── DNS Records ───────────────────────────────────────────────────────────────

export async function listDNSRecords(zoneId: string) {
  return cf(`/zones/${zoneId}/dns_records?per_page=100`);
}

export async function createDNSRecord(zoneId: string, record: {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
}) {
  return cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ ttl: 1, proxied: false, ...record }),
  });
}

export async function updateDNSRecord(zoneId: string, recordId: string, updates: Record<string, unknown>) {
  return cf(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteDNSRecord(zoneId: string, recordId: string) {
  return cf(`/zones/${zoneId}/dns_records/${recordId}`, { method: "DELETE" });
}

// ── Zone Settings ─────────────────────────────────────────────────────────────

export async function getZoneSettings(zoneId: string) {
  return cf(`/zones/${zoneId}/settings`);
}

// ── Page Rules / Redirects ────────────────────────────────────────────────────

export async function listPageRules(zoneId: string) {
  return cf(`/zones/${zoneId}/pagerules?status=active`);
}

// ── Workers ───────────────────────────────────────────────────────────────────

export async function listWorkers(accountId: string) {
  return cf(`/accounts/${accountId}/workers/scripts`);
}

// ── Tunnels ───────────────────────────────────────────────────────────────────

export async function listTunnels(accountId: string) {
  return cf(`/accounts/${accountId}/cfd_tunnel?per_page=50`);
}

export async function getTunnelConfig(accountId: string, tunnelId: string) {
  return cf(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`);
}
