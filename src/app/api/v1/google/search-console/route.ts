import { NextRequest, NextResponse } from "next/server";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import { listSites, querySearchAnalytics, getSitemaps, submitSitemap } from "@/lib/google/search-console";

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "sites";

  try {
    switch (action) {
      case "sites": {
        const sites = await listSites(auth.account);
        return NextResponse.json({ sites });
      }

      case "query": {
        const siteUrl = request.nextUrl.searchParams.get("siteUrl");
        if (!siteUrl) return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
        const startDate = request.nextUrl.searchParams.get("startDate") ?? "28daysAgo";
        const endDate = request.nextUrl.searchParams.get("endDate") ?? "today";
        const dimensionsParam = request.nextUrl.searchParams.get("dimensions");
        const dimensions = dimensionsParam ? dimensionsParam.split(",") : ["query"];
        const rowLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "25", 10);
        const rows = await querySearchAnalytics(auth.account, siteUrl, {
          startDate,
          endDate,
          dimensions,
          rowLimit,
        });
        return NextResponse.json({ rows });
      }

      case "sitemaps": {
        const siteUrl = request.nextUrl.searchParams.get("siteUrl");
        if (!siteUrl) return NextResponse.json({ error: "siteUrl required" }, { status: 400 });
        const sitemaps = await getSitemaps(auth.account, siteUrl);
        return NextResponse.json({ sitemaps });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Search Console API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  try {
    switch (body.action) {
      case "submit_sitemap": {
        const result = await submitSitemap(auth.account, body.siteUrl, body.feedpath);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Search Console API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" }, { status: 500 });
  }
}
