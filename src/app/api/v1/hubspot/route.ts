import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  searchContacts, getContact, createContact, updateContact,
  searchDeals, getDeal, createDeal, updateDeal,
  createNote, searchCompanies, listOwners, listPipelines,
  getContactActivities, logCall,
} from "@/lib/hubspot/client";

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

  const action = request.nextUrl.searchParams.get("action") ?? "search_contacts";

  try {
    switch (action) {
      case "search_contacts": {
        const q = request.nextUrl.searchParams.get("q") ?? "";
        const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
        return NextResponse.json(await searchContacts(q, limit));
      }
      case "get_contact": {
        const id = request.nextUrl.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getContact(id));
      }
      case "search_deals": {
        const q = request.nextUrl.searchParams.get("q") ?? "";
        const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
        return NextResponse.json(await searchDeals(q, limit));
      }
      case "get_deal": {
        const id = request.nextUrl.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getDeal(id));
      }
      case "search_companies": {
        const q = request.nextUrl.searchParams.get("q") ?? "";
        const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
        return NextResponse.json(await searchCompanies(q, limit));
      }
      case "owners":
        return NextResponse.json(await listOwners());
      case "pipelines":
        return NextResponse.json(await listPipelines());
      case "contact_activities": {
        const id = request.nextUrl.searchParams.get("id");
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
        return NextResponse.json(await getContactActivities(id, limit));
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "HubSpot API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();

  try {
    switch (body.action) {
      case "create_contact":
        return NextResponse.json(await createContact(body.properties));
      case "update_contact":
        return NextResponse.json(await updateContact(body.id, body.properties));
      case "create_deal":
        return NextResponse.json(await createDeal(body.properties));
      case "update_deal":
        return NextResponse.json(await updateDeal(body.id, body.properties));
      case "create_note":
        return NextResponse.json(await createNote(body.body, body.contactId, body.dealId, body.ownerId));
      case "log_call":
        return NextResponse.json(await logCall(body.contactId, body.body, body.durationMs ?? 0, body.ownerId));
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "HubSpot API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
