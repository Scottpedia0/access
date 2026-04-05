import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { getUserUsageReport, listActivities } from "@/lib/google/admin-reports";

function parseMax(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "activities";

  try {
    switch (action) {
      case "activities": {
        const applicationName =
          request.nextUrl.searchParams.get("applicationName") ?? "login";
        const data = await listActivities(auth.account, {
          applicationName,
          userKey: request.nextUrl.searchParams.get("userKey") ?? "all",
          maxResults: parseMax(
            request.nextUrl.searchParams.get("max"),
            100
          ),
          startTime: request.nextUrl.searchParams.get("startTime") ?? undefined,
          endTime: request.nextUrl.searchParams.get("endTime") ?? undefined,
          eventName: request.nextUrl.searchParams.get("eventName") ?? undefined,
          filters: request.nextUrl.searchParams.get("filters") ?? undefined,
          actorIpAddress:
            request.nextUrl.searchParams.get("actorIpAddress") ?? undefined,
          customerId:
            request.nextUrl.searchParams.get("customerId") ?? undefined,
          orgUnitId:
            request.nextUrl.searchParams.get("orgUnitId") ?? undefined,
          groupIdFilter:
            request.nextUrl.searchParams.get("groupIdFilter") ?? undefined,
          pageToken:
            request.nextUrl.searchParams.get("pageToken") ?? undefined,
        });
        return NextResponse.json(data);
      }

      case "usage": {
        const date = request.nextUrl.searchParams.get("date");
        if (!date) {
          return NextResponse.json(
            { error: "date required for usage action (YYYY-MM-DD)" },
            { status: 400 }
          );
        }

        const data = await getUserUsageReport(auth.account, {
          userKey: request.nextUrl.searchParams.get("userKey") ?? "all",
          date,
          maxResults: parseMax(
            request.nextUrl.searchParams.get("max"),
            100
          ),
          parameters:
            request.nextUrl.searchParams.get("parameters") ?? undefined,
          pageToken:
            request.nextUrl.searchParams.get("pageToken") ?? undefined,
        });
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
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
