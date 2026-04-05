import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listCustomers, getCustomer, listSubscriptions,
  listInvoices, listCharges, listWebhookEvents, getBalance,
} from "@/lib/stripe/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["customers", "customer", "subscriptions", "invoices", "charges", "events", "balance"]).default("customers"),
  id: z.string().min(1).optional(),
  email: z.string().optional(),
  customer: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional().default(25),
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
  const { action, id, email, customer, status, type, limit } = parsed.data;

  try {
    switch (action) {
      case "customers":
        return NextResponse.json(await listCustomers(email, limit));
      case "customer": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(await getCustomer(id));
      }
      case "subscriptions":
        return NextResponse.json(await listSubscriptions(customer, status, limit));
      case "invoices":
        return NextResponse.json(await listInvoices(customer, status, limit));
      case "charges":
        return NextResponse.json(await listCharges(customer, limit));
      case "events":
        return NextResponse.json(await listWebhookEvents(type, limit));
      case "balance":
        return NextResponse.json(await getBalance());
    }
  } catch (err) {
    return NextResponse.json({ error: "Stripe API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
