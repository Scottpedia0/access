import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { getUserUsageReport, listActivities } from "@/lib/google/admin-reports";

const getSchema = z.object({
  action: z.enum(["activities", "usage"]).default("activities"),
  applicationName: z.string().optional().default("login"),
  userKey: z.string().optional().default("all"),
  max: z.coerce.number().int().positive().max(1000).optional().default(100),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  eventName: z.string().optional(),
  filters: z.string().optional(),
  actorIpAddress: z.string().optional(),
  customerId: z.string().optional(),
  orgUnitId: z.string().optional(),
  groupIdFilter: z.string().optional(),
  pageToken: z.string().optional(),
  date: z.string().optional(),
  parameters: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  try {
    switch (p.action) {
      case "activities": {
        const data = await listActivities(auth.account, {
          applicationName: p.applicationName,
          userKey: p.userKey,
          maxResults: p.max,
          startTime: p.startTime ?? undefined,
          endTime: p.endTime ?? undefined,
          eventName: p.eventName ?? undefined,
          filters: p.filters ?? undefined,
          actorIpAddress: p.actorIpAddress ?? undefined,
          customerId: p.customerId ?? undefined,
          orgUnitId: p.orgUnitId ?? undefined,
          groupIdFilter: p.groupIdFilter ?? undefined,
          pageToken: p.pageToken ?? undefined,
        });
        return NextResponse.json(data);
      }

      case "usage": {
        if (!p.date) {
          return NextResponse.json(
            { error: "date required for usage action (YYYY-MM-DD)" },
            { status: 400 }
          );
        }

        const data = await getUserUsageReport(auth.account, {
          userKey: p.userKey,
          date: p.date,
          maxResults: p.max,
          parameters: p.parameters ?? undefined,
          pageToken: p.pageToken ?? undefined,
        });
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    const details = String(err);
    const needsReauth =
      details.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT") ||
      details.includes("insufficient authentication scopes") ||
      details.includes("Insufficient Permission");

    return NextResponse.json(
      {
        error: "Google Admin Reports API error",
        details,
        ...(needsReauth
          ? {
              hint:
                'Reauthorize the Google account after adding Admin Reports scopes. Visit /api/google/auth?account=go2 and approve the updated scopes.',
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
