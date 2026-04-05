import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getCalendar(alias: AccountAlias) {
  return google.calendar({
    version: "v3",
    auth: await getAuthenticatedClient(alias),
  });
}

export async function listCalendars(alias: AccountAlias) {
  const cal = await getCalendar(alias);
  const res = await cal.calendarList.list();
  return (res.data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary ?? false,
    accessRole: c.accessRole,
  }));
}

export async function listEvents(
  alias: AccountAlias,
  options?: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    query?: string;
  }
) {
  const cal = await getCalendar(alias);
  const res = await cal.events.list({
    calendarId: options?.calendarId ?? "primary",
    timeMin: options?.timeMin ?? new Date().toISOString(),
    timeMax: options?.timeMax,
    maxResults: options?.maxResults ?? 50,
    singleEvents: true,
    orderBy: "startTime",
    q: options?.query,
  });

  return (res.data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary,
    description: e.description,
    start: e.start,
    end: e.end,
    location: e.location,
    attendees: e.attendees?.map((a) => ({
      email: a.email,
      responseStatus: a.responseStatus,
      displayName: a.displayName,
    })),
    htmlLink: e.htmlLink,
    status: e.status,
    organizer: e.organizer,
  }));
}

export async function getEvent(
  alias: AccountAlias,
  eventId: string,
  calendarId = "primary"
) {
  const cal = await getCalendar(alias);
  const res = await cal.events.get({ calendarId, eventId });
  return res.data;
}

export async function createEvent(
  alias: AccountAlias,
  event: {
    summary: string;
    description?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: { email: string }[];
    location?: string;
  },
  calendarId = "primary"
) {
  const cal = await getCalendar(alias);
  const res = await cal.events.insert({
    calendarId,
    requestBody: event,
  });
  return { eventId: res.data.id, htmlLink: res.data.htmlLink };
}

export async function updateEvent(
  alias: AccountAlias,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    start?: { dateTime: string; timeZone?: string };
    end?: { dateTime: string; timeZone?: string };
    location?: string;
  },
  calendarId = "primary"
) {
  const cal = await getCalendar(alias);
  const res = await cal.events.patch({
    calendarId,
    eventId,
    requestBody: updates,
  });
  return res.data;
}

export async function deleteEvent(
  alias: AccountAlias,
  eventId: string,
  calendarId = "primary"
) {
  const cal = await getCalendar(alias);
  await cal.events.delete({ calendarId, eventId });
}
