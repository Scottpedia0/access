import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { searchContacts, listContacts } from "@/lib/google/contacts";

const getSchema = z.object({
  action: z.enum(["search", "list"]).default("search"),
  q: z.string().min(1).optional(),
  max: z.coerce.number().int().positive().max(500).optional().default(20),
  pageSize: z.coerce.number().int().positive().max(1000).optional().default(100),
  pageToken: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, q, max, pageSize, pageToken } = parsed.data;

  try {
    switch (action) {
      case "search": {
        if (!q)
          return NextResponse.json(
            { error: "q parameter required" },
            { status: 400 }
          );
        const contacts = await searchContacts(auth.account, q, max);
        return NextResponse.json({ contacts });
      }

      case "list": {
        const result = await listContacts(auth.account, pageSize, pageToken ?? undefined);
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Contacts API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
