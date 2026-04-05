import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { listAccounts, listContainers, listWorkspaces, listTags, listTriggers, listVariables } from "@/lib/google/tag-manager";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const p = request.nextUrl.searchParams;
  const action = p.get("action") ?? "accounts";

  try {
    switch (action) {
      case "accounts":
        return NextResponse.json({ accounts: await listAccounts(auth.account) });
      case "containers":
        return NextResponse.json({ containers: await listContainers(auth.account, p.get("accountId")!) });
      case "workspaces":
        return NextResponse.json({ workspaces: await listWorkspaces(auth.account, p.get("accountId")!, p.get("containerId")!) });
      case "tags":
        return NextResponse.json({ tags: await listTags(auth.account, p.get("accountId")!, p.get("containerId")!, p.get("workspaceId")!) });
      case "triggers":
        return NextResponse.json({ triggers: await listTriggers(auth.account, p.get("accountId")!, p.get("containerId")!, p.get("workspaceId")!) });
      case "variables":
        return NextResponse.json({ variables: await listVariables(auth.account, p.get("accountId")!, p.get("containerId")!, p.get("workspaceId")!) });
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Tag Manager API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
