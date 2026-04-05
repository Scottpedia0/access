import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getAnalytics(alias: AccountAlias) {
  return google.analyticsdata({ version: "v1beta", auth: await getAuthenticatedClient(alias) });
}

async function getAnalyticsAdmin(alias: AccountAlias) {
  return google.analyticsadmin({ version: "v1alpha", auth: await getAuthenticatedClient(alias) });
}

export async function listProperties(alias: AccountAlias) {
  const admin = await getAnalyticsAdmin(alias);
  const res = await admin.properties.list({ filter: "parent:accounts/-" });
  return res.data.properties ?? [];
}

export async function runReport(
  alias: AccountAlias,
  propertyId: string,
  options: {
    startDate: string;
    endDate: string;
    metrics: string[];
    dimensions?: string[];
    limit?: number;
  }
) {
  const analytics = await getAnalytics(alias);
  const res = await analytics.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      metrics: options.metrics.map((name) => ({ name })),
      dimensions: (options.dimensions ?? []).map((name) => ({ name })),
      limit: String(options.limit ?? 25),
    },
  });
  return {
    dimensionHeaders: res.data.dimensionHeaders ?? [],
    metricHeaders: res.data.metricHeaders ?? [],
    rows: res.data.rows ?? [],
    rowCount: res.data.rowCount ?? 0,
  };
}

export async function runRealtimeReport(
  alias: AccountAlias,
  propertyId: string,
  metrics: string[],
  dimensions?: string[]
) {
  const analytics = await getAnalytics(alias);
  const res = await analytics.properties.runRealtimeReport({
    property: `properties/${propertyId}`,
    requestBody: {
      metrics: metrics.map((name) => ({ name })),
      dimensions: (dimensions ?? []).map((name) => ({ name })),
    },
  });
  return {
    dimensionHeaders: res.data.dimensionHeaders ?? [],
    metricHeaders: res.data.metricHeaders ?? [],
    rows: res.data.rows ?? [],
  };
}
