import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { searchFiles, getFile, getFileContent, listFolder } from "@/lib/google/drive";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "search";

  try {
    switch (action) {
      case "search": {
        const q = request.nextUrl.searchParams.get("q") ?? "";
        const max = parseInt(request.nextUrl.searchParams.get("max") ?? "20", 10);
        const files = await searchFiles(auth.account, q, max);
        return NextResponse.json({ files });
      }

      case "get": {
        const fileId = request.nextUrl.searchParams.get("fileId");
        if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
        const file = await getFile(auth.account, fileId);
        return NextResponse.json(file);
      }

      case "export": {
        const fileId = request.nextUrl.searchParams.get("fileId");
        const mimeType = request.nextUrl.searchParams.get("mimeType") ?? "text/plain";
        if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });
        const content = await getFileContent(auth.account, fileId, mimeType);
        return NextResponse.json({ content });
      }

      case "list": {
        const folderId = request.nextUrl.searchParams.get("folderId") ?? "root";
        const max = parseInt(request.nextUrl.searchParams.get("max") ?? "50", 10);
        const files = await listFolder(auth.account, folderId, max);
        return NextResponse.json({ files });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Drive API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
