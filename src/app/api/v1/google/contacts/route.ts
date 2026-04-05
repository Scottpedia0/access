import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { searchContacts, listContacts } from "@/lib/google/contacts";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "search";

  try {
    switch (action) {
      case "search": {
        const query = request.nextUrl.searchParams.get("q");
        if (!query)
          return NextResponse.json(
            { error: "q parameter required" },
            { status: 400 }
          );
        const max = parseInt(
          request.nextUrl.searchParams.get("max") ?? "20",
          10
        );
        const contacts = await searchContacts(auth.account, query, max);
        return NextResponse.json({ contacts });
      }

      case "list": {
        const pageSize = parseInt(
          request.nextUrl.searchParams.get("pageSize") ?? "100",
          10
        );
        const pageToken =
          request.nextUrl.searchParams.get("pageToken") ?? undefined;
        const result = await listContacts(auth.account, pageSize, pageToken);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Contacts API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
