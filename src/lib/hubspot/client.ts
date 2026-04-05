const BASE = "https://api.hubapi.com";

function headers() {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) throw new Error("HUBSPOT_PRIVATE_APP_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function hs(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(), ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function searchContacts(query: string, limit = 20) {
  return hs("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit,
      properties: ["firstname", "lastname", "email", "phone", "company", "jobtitle", "hs_lead_status", "lifecyclestage"],
    }),
  });
}

export async function getContact(contactId: string) {
  return hs(`/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,company,jobtitle,hs_lead_status,lifecyclestage,notes_last_contacted,hs_sales_email_last_replied`);
}

export async function createContact(properties: Record<string, string>) {
  return hs("/crm/v3/objects/contacts", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
}

export async function updateContact(contactId: string, properties: Record<string, string>) {
  return hs(`/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

// ── Deals ─────────────────────────────────────────────────────────────────────

export async function searchDeals(query: string, limit = 20) {
  return hs("/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit,
      properties: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hubspot_owner_id"],
    }),
  });
}

export async function getDeal(dealId: string) {
  return hs(`/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,pipeline,closedate,hubspot_owner_id,description`);
}

export async function createDeal(properties: Record<string, string>) {
  return hs("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({ properties }),
  });
}

export async function updateDeal(dealId: string, properties: Record<string, string>) {
  return hs(`/crm/v3/objects/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function createNote(body: string, contactId?: string, dealId?: string, ownerId?: string) {
  const note = await hs("/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_note_body: body,
        hs_timestamp: new Date().toISOString(),
        ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
      },
    }),
  });

  // Associate with contact and/or deal
  const associations = [];
  if (contactId) associations.push(hs(`/crm/v3/objects/notes/${note.id}/associations/contacts/${contactId}/note_to_contact`, { method: "PUT" }));
  if (dealId) associations.push(hs(`/crm/v3/objects/notes/${note.id}/associations/deals/${dealId}/note_to_deal`, { method: "PUT" }));
  if (associations.length) await Promise.all(associations);

  return note;
}

// ── Companies ─────────────────────────────────────────────────────────────────

export async function searchCompanies(query: string, limit = 20) {
  return hs("/crm/v3/objects/companies/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit,
      properties: ["name", "domain", "industry", "numberofemployees", "city", "state"],
    }),
  });
}

// ── Owners ────────────────────────────────────────────────────────────────────

export async function listOwners() {
  return hs("/crm/v3/owners?limit=100");
}

// ── Pipelines ─────────────────────────────────────────────────────────────────

export async function listPipelines() {
  return hs("/crm/v3/pipelines/deals");
}

// ── Activities (calls, emails, meetings) ─────────────────────────────────────

export async function getContactActivities(contactId: string, limit = 20) {
  return hs(`/crm/v3/objects/contacts/${contactId}/associations/engagements?limit=${limit}`);
}

export async function logCall(contactId: string, body: string, durationMs: number, ownerId?: string) {
  const engagement = await hs("/crm/v3/objects/calls", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_call_body: body,
        hs_call_duration: String(durationMs),
        hs_call_status: "COMPLETED",
        hs_timestamp: new Date().toISOString(),
        ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
      },
    }),
  });

  await hs(`/crm/v3/objects/calls/${engagement.id}/associations/contacts/${contactId}/call_to_contact`, { method: "PUT" });
  return engagement;
}
