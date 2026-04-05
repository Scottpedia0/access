import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { getSpreadsheet, readRange, writeRange, appendRows } from "@/lib/google/sheets";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["get", "read"]).default("read"),
  spreadsheetId: z.string().min(1),
  range: z.string().optional().default("Sheet1"),
});

const postSchema = z.object({
  action: z.enum(["write", "append"]),
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, spreadsheetId, range } = parsed.data;

  try {
    switch (action) {
      case "get": {
        const data = await getSpreadsheet(auth.account, spreadsheetId);
        return NextResponse.json(data);
      }

      case "read": {
        const values = await readRange(auth.account, spreadsheetId, range);
        return NextResponse.json({ values });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Sheets API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, spreadsheetId, range, values } = parsed.data;

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
    }
  } catch (err) {
    return NextResponse.json({ error: "Sheets API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
