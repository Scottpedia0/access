import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import { listDomains, getDomainStatus, listDNSRecords, createDNSRecord, updateDNSRecord, deleteDNSRecord, checkDomainAvailability } from "@/lib/porkbun/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["domains", "status", "dns", "check"]).default("domains"),
  domain: z.string().min(1).optional(),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_dns"), domain: z.string().min(1), record: z.object({ type: z.string(), content: z.string(), name: z.string().optional(), ttl: z.string().optional(), prio: z.string().optional() }) }),
  z.object({ action: z.literal("update_dns"), domain: z.string().min(1), id: z.string().min(1), record: z.object({ type: z.string(), content: z.string(), name: z.string().optional(), ttl: z.string().optional() }) }),
  z.object({ action: z.literal("delete_dns"), domain: z.string().min(1), id: z.string().min(1) }),
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
  const { action, domain } = parsed.data;

  try {
    switch (action) {
      case "domains":
        return NextResponse.json(await listDomains());
      case "status": {
        if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
        return NextResponse.json(await getDomainStatus(domain));
      }
      case "dns": {
        if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
        return NextResponse.json(await listDNSRecords(domain));
      }
      case "check": {
        if (!domain) return NextResponse.json({ error: "domain required" }, { status: 400 });
        return NextResponse.json(await checkDomainAvailability(domain));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Porkbun API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
        return NextResponse.json(await createDNSRecord(data.domain, data.record));
      case "update_dns":
        return NextResponse.json(await updateDNSRecord(data.domain, data.id, data.record));
      case "delete_dns":
        return NextResponse.json(await deleteDNSRecord(data.domain, data.id));
    }
  } catch (err) {
    return NextResponse.json({ error: "Porkbun API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
