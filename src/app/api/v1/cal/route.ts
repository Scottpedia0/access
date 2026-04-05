import { NextRequest, NextResponse } from "next/server";
import { isValidGlobalAgentToken } from "@/lib/env";
import { listBookings, getBooking, cancelBooking, listEventTypes, getSchedule } from "@/lib/cal/client";

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

  const action = request.nextUrl.searchParams.get("action") ?? "bookings";

  try {
    switch (action) {
      case "bookings": {
        const status = request.nextUrl.searchParams.get("status") ?? undefined;
        const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
        return NextResponse.json(await listBookings(status, limit));
      }
      case "booking": {
        const id = request.nextUrl.searchParams.get("bookingId");
        if (!id) return NextResponse.json({ error: "bookingId required" }, { status: 400 });
        return NextResponse.json(await getBooking(parseInt(id, 10)));
      }
      case "event-types":
        return NextResponse.json(await listEventTypes());
      case "schedule":
        return NextResponse.json(await getSchedule());
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Cal.com API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();

  try {
    switch (body.action) {
      case "cancel": {
        const result = await cancelBooking(body.bookingId, body.reason);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Cal.com API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
