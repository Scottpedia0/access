const BASE = "https://api.cal.com/v2";

function headers(version = "2024-08-13") {
  const key = process.env.CAL_API_KEY;
  if (!key) throw new Error("CAL_API_KEY not set");
  return { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "cal-api-version": version };
}

async function calFetch(path: string, options: RequestInit = {}, version = "2024-08-13") {
  const res = await fetch(`${BASE}${path}`, { headers: headers(version), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cal.com API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function listBookings(status?: string, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return calFetch(`/bookings?${params}`);
}

export async function getBooking(bookingId: number) {
  return calFetch(`/bookings/${bookingId}`);
}

export async function cancelBooking(bookingId: number, reason?: string) {
  return calFetch(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: reason ?? "Cancelled by agent" }),
  });
}

export async function listEventTypes() {
  return calFetch("/event-types", {}, "2024-06-14");
}

export async function getSchedule() {
  return calFetch("/schedules");
}

export async function listCalendars() {
  return calFetch("/calendars");
}
