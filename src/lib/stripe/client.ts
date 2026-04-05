const BASE = "https://api.stripe.com/v1";

function headers() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

async function stripe(path: string, params?: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe API error ${res.status}: ${text}`);
  }
  return res.json();
}

// -- GET actions --------------------------------------------------------------

export async function listCustomers(email?: string, limit = 25) {
  const params: Record<string, string> = { limit: String(limit) };
  if (email) params.email = email;
  return stripe("/customers", params);
}

export async function getCustomer(id: string) {
  return stripe(`/customers/${id}`);
}

export async function listSubscriptions(customer?: string, status?: string, limit = 25) {
  const params: Record<string, string> = { limit: String(limit) };
  if (customer) params.customer = customer;
  if (status) params.status = status;
  return stripe("/subscriptions", params);
}

export async function listInvoices(customer?: string, status?: string, limit = 25) {
  const params: Record<string, string> = { limit: String(limit) };
  if (customer) params.customer = customer;
  if (status) params.status = status;
  return stripe("/invoices", params);
}

export async function listCharges(customer?: string, limit = 25) {
  const params: Record<string, string> = { limit: String(limit) };
  if (customer) params.customer = customer;
  return stripe("/charges", params);
}

export async function listWebhookEvents(type?: string, limit = 25) {
  const params: Record<string, string> = { limit: String(limit) };
  if (type) params.type = type;
  return stripe("/events", params);
}

export async function getBalance() {
  return stripe("/balance");
}
