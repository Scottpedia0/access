import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { listProperties, runReport, runRealtimeReport } from "@/lib/google/analytics";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "properties";

  try {
    switch (action) {
      case "properties": {
        const properties = await listProperties(auth.account);
        return NextResponse.json({ properties });
      }

      case "report": {
        const propertyId = request.nextUrl.searchParams.get("propertyId");
        if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });
        const startDate = request.nextUrl.searchParams.get("startDate") ?? "28daysAgo";
        const endDate = request.nextUrl.searchParams.get("endDate") ?? "today";
        const metricsParam = request.nextUrl.searchParams.get("metrics") ?? "sessions,activeUsers";
        const dimensionsParam = request.nextUrl.searchParams.get("dimensions");
        const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "25", 10);
        const result = await runReport(auth.account, propertyId, {
          startDate,
          endDate,
          metrics: metricsParam.split(","),
          dimensions: dimensionsParam ? dimensionsParam.split(",") : undefined,
          limit,
        });
        return NextResponse.json(result);
      }

      case "realtime": {
        const propertyId = request.nextUrl.searchParams.get("propertyId");
        if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });
        const metricsParam = request.nextUrl.searchParams.get("metrics") ?? "activeUsers";
        const dimensionsParam = request.nextUrl.searchParams.get("dimensions");
        const result = await runRealtimeReport(
          auth.account,
          propertyId,
          metricsParam.split(","),
          dimensionsParam ? dimensionsParam.split(",") : undefined
        );
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Analytics API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
