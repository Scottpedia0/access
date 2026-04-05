import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { listSites, querySearchAnalytics, getSitemaps, submitSitemap } from "@/lib/google/search-console";

const getSchema = z.object({
  action: z.enum(["sites", "query", "sitemaps"]).default("sites"),
  siteUrl: z.string().min(1).optional(),
  startDate: z.string().optional().default("28daysAgo"),
  endDate: z.string().optional().default("today"),
  dimensions: z.string().optional(),
  limit: z.coerce.number().int().positive().max(25000).optional().default(25),
});

const postSchema = z.object({
  action: z.enum(["submit_sitemap"]),
  siteUrl: z.string().min(1),
  feedpath: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, siteUrl, startDate, endDate, dimensions, limit } = parsed.data;

  try {
    switch (action) {
      case "sites": {
        const sites = await listSites(auth.account);
        return NextResponse.json({ sites });
      }

      case "query": {
        if (!siteUrl) return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
        const dims = dimensions ? dimensions.split(",") : ["query"];
        const rows = await querySearchAnalytics(auth.account, siteUrl, {
          startDate,
          endDate,
          dimensions: dims,
          rowLimit: limit,
        });
        return NextResponse.json({ rows });
      }

      case "sitemaps": {
        if (!siteUrl) return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
        const sitemaps = await getSitemaps(auth.account, siteUrl);
        return NextResponse.json({ sitemaps });
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Search Console API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
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
  const data = parsed.data;

  try {
    switch (data.action) {
      case "submit_sitemap": {
        const result = await submitSitemap(auth.account, data.siteUrl, data.feedpath);
        return NextResponse.json(result);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "Search Console API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
