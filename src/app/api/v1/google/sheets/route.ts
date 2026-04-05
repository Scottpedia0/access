import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { getSpreadsheet, readRange, writeRange, appendRows } from "@/lib/google/sheets";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "read";
  const spreadsheetId = request.nextUrl.searchParams.get("spreadsheetId");
  if (!spreadsheetId) return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });

  try {
    switch (action) {
      case "get": {
        const data = await getSpreadsheet(auth.account, spreadsheetId);
        return NextResponse.json(data);
      }

      case "read": {
        const range = request.nextUrl.searchParams.get("range") ?? "Sheet1";
        const values = await readRange(auth.account, spreadsheetId, range);
        return NextResponse.json({ values });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Sheets API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { action, spreadsheetId, range, values } = body;

  if (!spreadsheetId) return NextResponse.json({ error: "spreadsheetId required" }, { status: 400 });

  try {
    switch (action) {
      case "write": {
        const result = await writeRange(auth.account, spreadsheetId, range, values);
        return NextResponse.json(result);
      }

      case "append": {
        const result = await appendRows(auth.account, spreadsheetId, range, values);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Sheets API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
