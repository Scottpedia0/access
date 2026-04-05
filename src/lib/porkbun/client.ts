const BASE = "https://api.porkbun.com/api/json/v3";

function keys() {
  const apikey = process.env.PORKBUN_API_KEY;
  const secretapikey = process.env.PORKBUN_SECRET_KEY;
  if (!apikey || !secretapikey) throw new Error("PORKBUN_API_KEY and PORKBUN_SECRET_KEY must be set");
  return { apikey, secretapikey };
}

async function pb(path: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...keys(), ...body }),
  });
  const data = await res.json() as { status: string; [key: string]: unknown };
  if (data.status !== "SUCCESS") throw new Error(`Porkbun error: ${JSON.stringify(data)}`);
  return data;
}

export async function listDomains() {
  return pb("/domain/listAll");
}

export async function getDomainStatus(domain: string) {
  return pb(`/domain/getStatus/${domain}`);
}

export async function listDNSRecords(domain: string) {
  return pb(`/dns/retrieve/${domain}`);
}

export async function createDNSRecord(domain: string, record: {
  type: string;
  name?: string;
  content: string;
  ttl?: string;
  prio?: string;
}) {
  return pb(`/dns/create/${domain}`, record);
}

export async function updateDNSRecord(domain: string, id: string, record: {
  type: string;
  name?: string;
  content: string;
  ttl?: string;
}) {
  return pb(`/dns/edit/${domain}/${id}`, record);
}

export async function deleteDNSRecord(domain: string, id: string) {
  return pb(`/dns/delete/${domain}/${id}`);
}

export async function getSSLBundle(domain: string) {
  return pb(`/ssl/retrieve/${domain}`);
}

export async function checkDomainAvailability(domain: string) {
  return pb(`/domain/checkAvailability`, { domain });
}
