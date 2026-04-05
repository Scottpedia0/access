import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listAccounts, listZones, getZone,
  listDNSRecords, createDNSRecord, updateDNSRecord, deleteDNSRecord,
  getZoneSettings, listPageRules, listWorkers, listTunnels, getTunnelConfig,
} from "@/lib/cloudflare/client";

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

  const p = request.nextUrl.searchParams;
  const action = p.get("action") ?? "zones";

  try {
    switch (action) {
      case "accounts":
        return NextResponse.json({ accounts: await listAccounts() });
      case "zones":
        return NextResponse.json({ zones: await listZones(p.get("accountId") ?? undefined) });
      case "zone":
        return NextResponse.json(await getZone(p.get("zoneId")!));
      case "dns": {
        const zoneId = p.get("zoneId");
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json({ records: await listDNSRecords(zoneId) });
      }
      case "zone_settings": {
        const zoneId = p.get("zoneId");
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json({ settings: await getZoneSettings(zoneId) });
      }
      case "page_rules": {
        const zoneId = p.get("zoneId");
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json({ rules: await listPageRules(zoneId) });
      }
      case "workers": {
        const accountId = p.get("accountId");
        if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
        return NextResponse.json({ workers: await listWorkers(accountId) });
      }
      case "tunnels": {
        const accountId = p.get("accountId");
        if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
        return NextResponse.json({ tunnels: await listTunnels(accountId) });
      }
      case "tunnel_config": {
        const accountId = p.get("accountId");
        const tunnelId = p.get("tunnelId");
        if (!accountId || !tunnelId) return NextResponse.json({ error: "accountId and tunnelId required" }, { status: 400 });
        return NextResponse.json(await getTunnelConfig(accountId, tunnelId));
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Cloudflare API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();

  try {
    switch (body.action) {
      case "create_dns":
        return NextResponse.json(await createDNSRecord(body.zoneId, body.record));
      case "update_dns":
        return NextResponse.json(await updateDNSRecord(body.zoneId, body.recordId, body.updates));
      case "delete_dns":
        return NextResponse.json(await deleteDNSRecord(body.zoneId, body.recordId));
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Cloudflare API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
