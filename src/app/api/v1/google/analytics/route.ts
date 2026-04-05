import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { listProperties, runReport, runRealtimeReport } from "@/lib/google/analytics";

const getSchema = z.object({
  action: z.enum(["properties", "report", "realtime"]).default("properties"),
  propertyId: z.string().min(1).optional(),
  startDate: z.string().optional().default("28daysAgo"),
  endDate: z.string().optional().default("today"),
  metrics: z.string().optional(),
  dimensions: z.string().optional(),
  limit: z.coerce.number().int().positive().max(10000).optional().default(25),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, propertyId, startDate, endDate, metrics, dimensions, limit } = parsed.data;

  try {
    switch (action) {
      case "properties": {
        const properties = await listProperties(auth.account);
        return NextResponse.json({ properties });
      }

      case "report": {
        if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });
        const metricsParam = metrics ?? "sessions,activeUsers";
        const result = await runReport(auth.account, propertyId, {
          startDate,
          endDate,
          metrics: metricsParam.split(","),
          dimensions: dimensions ? dimensions.split(",") : undefined,
          limit,
        });
        return NextResponse.json(result);
      }

      case "realtime": {
        if (!propertyId) return NextResponse.json({ error: "propertyId required" }, { status: 400 });
        const metricsParam = metrics ?? "activeUsers";
        const result = await runRealtimeReport(
          auth.account,
          propertyId,
          metricsParam.split(","),
          dimensions ? dimensions.split(",") : undefined
        );
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Analytics API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
