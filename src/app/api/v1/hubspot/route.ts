import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  searchContacts, getContact, createContact, updateContact,
  searchDeals, getDeal, createDeal, updateDeal,
  createNote, searchCompanies, listOwners, listPipelines,
  getContactActivities, logCall,
} from "@/lib/hubspot/client";

const getSchema = z.object({
  action: z.enum(["search_contacts", "get_contact", "search_deals", "get_deal", "search_companies", "owners", "pipelines", "contact_activities"]).default("search_contacts"),
  q: z.string().optional().default(""),
  id: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(20),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_contact"), properties: z.record(z.string(), z.string()) }),
  z.object({ action: z.literal("update_contact"), id: z.string().min(1), properties: z.record(z.string(), z.string()) }),
  z.object({ action: z.literal("create_deal"), properties: z.record(z.string(), z.string()) }),
  z.object({ action: z.literal("update_deal"), id: z.string().min(1), properties: z.record(z.string(), z.string()) }),
  z.object({ action: z.literal("create_note"), body: z.string().min(1), contactId: z.string().optional(), dealId: z.string().optional(), ownerId: z.string().optional() }),
  z.object({ action: z.literal("log_call"), contactId: z.string().min(1), body: z.string().min(1), durationMs: z.number().int().nonnegative().optional().default(0), ownerId: z.string().optional() }),
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
  const { action, q, id, limit } = parsed.data;

  try {
    switch (action) {
      case "search_contacts":
        return NextResponse.json(await searchContacts(q, limit));
      case "get_contact": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getContact(id));
      }
      case "search_deals":
        return NextResponse.json(await searchDeals(q, limit));
      case "get_deal": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getDeal(id));
      }
      case "search_companies":
        return NextResponse.json(await searchCompanies(q, limit));
      case "owners":
        return NextResponse.json(await listOwners());
      case "pipelines":
        return NextResponse.json(await listPipelines());
      case "contact_activities": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getContactActivities(id, limit));
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "HubSpot API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
      case "create_contact":
        return NextResponse.json(await createContact(data.properties));
      case "update_contact":
        return NextResponse.json(await updateContact(data.id, data.properties));
      case "create_deal":
        return NextResponse.json(await createDeal(data.properties));
      case "update_deal":
        return NextResponse.json(await updateDeal(data.id, data.properties));
      case "create_note":
        return NextResponse.json(await createNote(data.body, data.contactId, data.dealId, data.ownerId));
      case "log_call":
        return NextResponse.json(await logCall(data.contactId, data.body, data.durationMs, data.ownerId));
    }
  } catch (err) {
    return NextResponse.json({ error: "HubSpot API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
