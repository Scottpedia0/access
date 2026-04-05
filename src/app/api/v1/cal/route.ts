import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import { listBookings, getBooking, cancelBooking, listEventTypes, getSchedule } from "@/lib/cal/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["bookings", "booking", "event-types", "schedule"]).default("bookings"),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(20),
  bookingId: z.coerce.number().int().positive().optional(),
});

const postSchema = z.object({
  action: z.enum(["cancel"]),
  bookingId: z.number().int().positive(),
  reason: z.string().optional(),
});

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
  const { action, status, limit, bookingId } = parsed.data;

  try {
    switch (action) {
      case "bookings":
        return NextResponse.json(await listBookings(status ?? undefined, limit));
      case "booking": {
        if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
        return NextResponse.json(await getBooking(bookingId));
      }
      case "event-types":
        return NextResponse.json(await listEventTypes());
      case "schedule":
        return NextResponse.json(await getSchedule());
    }
  } catch (err) {
    return NextResponse.json({ error: "Cal.com API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
      case "cancel": {
        const result = await cancelBooking(data.bookingId, data.reason);
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Cal.com API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
