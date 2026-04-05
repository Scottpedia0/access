import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import { listDomains, getDomainStatus, listDNSRecords, createDNSRecord, updateDNSRecord, deleteDNSRecord, checkDomainAvailability } from "@/lib/porkbun/client";

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
  const action = p.get("action") ?? "domains";

  try {
    switch (action) {
      case "domains":
        return NextResponse.json(await listDomains());
      case "status":
        return NextResponse.json(await getDomainStatus(p.get("domain")!));
      case "dns":
        return NextResponse.json(await listDNSRecords(p.get("domain")!));
      case "check":
        return NextResponse.json(await checkDomainAvailability(p.get("domain")!));
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Porkbun API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();

  try {
    switch (body.action) {
      case "create_dns":
        return NextResponse.json(await createDNSRecord(body.domain, body.record));
      case "update_dns":
        return NextResponse.json(await updateDNSRecord(body.domain, body.id, body.record));
      case "delete_dns":
        return NextResponse.json(await deleteDNSRecord(body.domain, body.id));
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Porkbun API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
