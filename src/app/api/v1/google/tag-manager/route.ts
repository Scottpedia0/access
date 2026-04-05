import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { listAccounts, listContainers, listWorkspaces, listTags, listTriggers, listVariables } from "@/lib/google/tag-manager";

const getSchema = z.object({
  action: z.enum(["accounts", "containers", "workspaces", "tags", "triggers", "variables"]).default("accounts"),
  accountId: z.string().min(1).optional(),
  containerId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, accountId, containerId, workspaceId } = parsed.data;

  try {
    switch (action) {
      case "accounts":
        return NextResponse.json({ accounts: await listAccounts(auth.account) });
      case "containers": {
        if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });
        return NextResponse.json({ containers: await listContainers(auth.account, accountId) });
      }
      case "workspaces": {
        if (!accountId || !containerId) return NextResponse.json({ error: "accountId and containerId required" }, { status: 400 });
        return NextResponse.json({ workspaces: await listWorkspaces(auth.account, accountId, containerId) });
      }
      case "tags": {
        if (!accountId || !containerId || !workspaceId) return NextResponse.json({ error: "accountId, containerId, and workspaceId required" }, { status: 400 });
        return NextResponse.json({ tags: await listTags(auth.account, accountId, containerId, workspaceId) });
      }
      case "triggers": {
        if (!accountId || !containerId || !workspaceId) return NextResponse.json({ error: "accountId, containerId, and workspaceId required" }, { status: 400 });
        return NextResponse.json({ triggers: await listTriggers(auth.account, accountId, containerId, workspaceId) });
      }
      case "variables": {
        if (!accountId || !containerId || !workspaceId) return NextResponse.json({ error: "accountId, containerId, and workspaceId required" }, { status: 400 });
        return NextResponse.json({ variables: await listVariables(auth.account, accountId, containerId, workspaceId) });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Tag Manager API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
