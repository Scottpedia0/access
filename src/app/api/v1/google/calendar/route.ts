import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import {
  listCalendars,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/google/calendar";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "events";

  try {
    switch (action) {
      case "calendars": {
        const calendars = await listCalendars(auth.account);
        return NextResponse.json({ calendars });
      }

      case "events": {
        const events = await listEvents(auth.account, {
          calendarId:
            request.nextUrl.searchParams.get("calendarId") ?? undefined,
          timeMin: request.nextUrl.searchParams.get("timeMin") ?? undefined,
          timeMax: request.nextUrl.searchParams.get("timeMax") ?? undefined,
          maxResults: parseInt(
            request.nextUrl.searchParams.get("max") ?? "50",
            10
          ),
          query: request.nextUrl.searchParams.get("q") ?? undefined,
        });
        return NextResponse.json({ events });
      }

      case "event": {
        const eventId = request.nextUrl.searchParams.get("eventId");
        if (!eventId)
          return NextResponse.json(
            { error: "eventId required" },
            { status: 400 }
          );
        const event = await getEvent(
          auth.account,
          eventId,
          request.nextUrl.searchParams.get("calendarId") ?? undefined
        );
        return NextResponse.json(event);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Calendar API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const auth = authenticateGoogleRequest(request, body.account);
  if (auth instanceof NextResponse) return auth;
  const action = body.action;

  try {
    switch (action) {
      case "create": {
        const result = await createEvent(
          auth.account,
          {
            summary: body.summary,
            description: body.description,
            start: body.start,
            end: body.end,
            attendees: body.attendees,
            location: body.location,
          },
          body.calendarId
        );
        return NextResponse.json(result);
      }

      case "update": {
        const result = await updateEvent(
          auth.account,
          body.eventId,
          {
            summary: body.summary,
            description: body.description,
            start: body.start,
            end: body.end,
            location: body.location,
          },
          body.calendarId
        );
        return NextResponse.json(result);
      }

      case "delete": {
        await deleteEvent(auth.account, body.eventId, body.calendarId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Calendar API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
