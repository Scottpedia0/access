import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listAccounts, listZones, getZone,
  listDNSRecords, createDNSRecord, updateDNSRecord, deleteDNSRecord,
  getZoneSettings, listPageRules, listWorkers, listTunnels, getTunnelConfig,
} from "@/lib/cloudflare/client";

const getSchema = z.object({
  action: z.enum(["accounts", "zones", "zone", "dns", "zone_settings", "page_rules", "workers", "tunnels", "tunnel_config"]).default("zones"),
  accountId: z.string().min(1).optional(),
  zoneId: z.string().min(1).optional(),
  tunnelId: z.string().min(1).optional(),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_dns"), zoneId: z.string().min(1), record: z.record(z.any()) }),
  z.object({ action: z.literal("update_dns"), zoneId: z.string().min(1), recordId: z.string().min(1), updates: z.record(z.any()) }),
  z.object({ action: z.literal("delete_dns"), zoneId: z.string().min(1), recordId: z.string().min(1) }),
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
  const { action, accountId, zoneId, tunnelId } = parsed.data;

  try {
    switch (action) {
      case "accounts":
        return NextResponse.json({ accounts: await listAccounts() });
      case "zones":
        return NextResponse.json({ zones: await listZones(accountId ?? undefined) });
      case "zone": {
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json(await getZone(zoneId));
      }
      case "dns": {
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json({ records: await listDNSRecords(zoneId) });
      }
      case "zone_settings": {
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json({ settings: await getZoneSettings(zoneId) });
      }
      case "page_rules": {
        if (!zoneId) return NextResponse.json({ error: "zoneId required" }, { status: 400 });
        return NextResponse.json({ rules: await listPageRules(zoneId) });
      }
      case "workers": {
        if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
        return NextResponse.json({ workers: await listWorkers(accountId) });
      }
      case "tunnels": {
        if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
        return NextResponse.json({ tunnels: await listTunnels(accountId) });
      }
      case "tunnel_config": {
        if (!accountId || !tunnelId) return NextResponse.json({ error: "accountId and tunnelId required" }, { status: 400 });
        return NextResponse.json(await getTunnelConfig(accountId, tunnelId));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Cloudflare API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
      case "create_dns":
        return NextResponse.json(await createDNSRecord(data.zoneId, data.record));
      case "update_dns":
        return NextResponse.json(await updateDNSRecord(data.zoneId, data.recordId, data.updates));
      case "delete_dns":
        return NextResponse.json(await deleteDNSRecord(data.zoneId, data.recordId));
    }
  } catch (err) {
    return NextResponse.json({ error: "Cloudflare API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
