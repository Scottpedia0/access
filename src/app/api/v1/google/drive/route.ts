import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { searchFiles, getFile, getFileContent, listFolder } from "@/lib/google/drive";

const getSchema = z.object({
  action: z.enum(["search", "get", "export", "list"]).default("search"),
  q: z.string().optional().default(""),
  max: z.coerce.number().int().positive().max(1000).optional().default(20),
  fileId: z.string().min(1).optional(),
  mimeType: z.string().optional().default("text/plain"),
  folderId: z.string().optional().default("root"),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, q, max, fileId, mimeType, folderId } = parsed.data;

  try {
    switch (action) {
      case "search": {
        const files = await searchFiles(auth.account, q, max);
        return NextResponse.json({ files });
      }

      case "get": {
        if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
        const file = await getFile(auth.account, fileId);
        return NextResponse.json(file);
      }

      case "export": {
        if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
        const content = await getFileContent(auth.account, fileId, mimeType);
        return NextResponse.json({ content });
      }

      case "list": {
        const files = await listFolder(auth.account, folderId, max);
        return NextResponse.json({ files });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Drive API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
