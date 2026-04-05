import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import {
  listCalendars,
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/google/calendar";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["calendars", "events", "event"]).default("events"),
  calendarId: z.string().optional(),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  max: z.coerce.number().int().positive().max(2500).optional().default(50),
  q: z.string().optional(),
  eventId: z.string().min(1).optional(),
});

/** Google Calendar event datetime: either { dateTime } or { date }, with optional timeZone. */
const eventDateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
}).refine(d => d.dateTime || d.date, { message: "Either dateTime or date is required" });

const attendeeSchema = z.object({
  email: z.string().min(1),
  displayName: z.string().optional(),
  optional: z.boolean().optional(),
  responseStatus: z.string().optional(),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    account: z.string().optional(),
    calendarId: z.string().optional(),
    summary: z.string().min(1),
    description: z.string().optional(),
    start: eventDateTimeSchema,
    end: eventDateTimeSchema,
    attendees: z.array(attendeeSchema).optional(),
    location: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    account: z.string().optional(),
    calendarId: z.string().optional(),
    eventId: z.string().min(1),
    summary: z.string().optional(),
    description: z.string().optional(),
    start: eventDateTimeSchema.optional(),
    end: eventDateTimeSchema.optional(),
    location: z.string().optional(),
  }),
  z.object({
    action: z.literal("delete"),
    account: z.string().optional(),
    calendarId: z.string().optional(),
    eventId: z.string().min(1),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, calendarId, timeMin, timeMax, max, q, eventId } = parsed.data;

  try {
    switch (action) {
      case "calendars": {
        const calendars = await listCalendars(auth.account);
        return NextResponse.json({ calendars });
      }

      case "events": {
        const events = await listEvents(auth.account, {
          calendarId: calendarId ?? undefined,
          timeMin: timeMin ?? undefined,
          timeMax: timeMax ?? undefined,
          maxResults: max,
          query: q ?? undefined,
        });
        return NextResponse.json({ events });
      }

      case "event": {
        if (!eventId)
          return NextResponse.json(
            { error: "eventId required" },
            { status: 400 }
          );
        const event = await getEvent(
          auth.account,
          eventId,
          calendarId ?? undefined
        );
        return NextResponse.json(event);
      }
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

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const auth = authenticateGoogleRequest(request, body.account);
  if (auth instanceof NextResponse) return auth;

  try {
    switch (data.action) {
      case "create": {
        const result = await createEvent(
          auth.account,
          {
            summary: data.summary,
            description: data.description,
            start: data.start as unknown as { dateTime: string; timeZone?: string },
            end: data.end as unknown as { dateTime: string; timeZone?: string },
            attendees: data.attendees as { email: string; displayName?: string; optional?: boolean; responseStatus?: string }[],
            location: data.location,
          },
          data.calendarId
        );
        return NextResponse.json(result);
      }

      case "update": {
        const result = await updateEvent(
          auth.account,
          data.eventId,
          {
            summary: data.summary,
            description: data.description,
            start: data.start as unknown as { dateTime: string; timeZone?: string } | undefined,
            end: data.end as unknown as { dateTime: string; timeZone?: string } | undefined,
            location: data.location,
          },
          data.calendarId
        );
        return NextResponse.json(result);
      }

      case "delete": {
        await deleteEvent(auth.account, data.eventId, data.calendarId);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Calendar API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
