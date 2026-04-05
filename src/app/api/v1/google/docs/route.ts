import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { getDocument, getDocumentText, appendText } from "@/lib/google/docs";

const getSchema = z.object({
  action: z.enum(["get", "text"]).default("text"),
  documentId: z.string().min(1),
});

const postSchema = z.object({
  action: z.enum(["append"]),
  documentId: z.string().min(1),
  text: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, documentId } = parsed.data;

  try {
    switch (action) {
      case "get": {
        const doc = await getDocument(auth.account, documentId);
        return NextResponse.json(doc);
      }
      case "text": {
        const text = await getDocumentText(auth.account, documentId);
        return NextResponse.json({ text });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Docs API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
  const { action, documentId, text } = parsed.data;

  try {
    switch (action) {
      case "append": {
        const result = await appendText(auth.account, documentId, text);
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Docs API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
