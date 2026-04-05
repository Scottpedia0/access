import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getSearchConsole(alias: AccountAlias) {
  return google.searchconsole({ version: "v1", auth: await getAuthenticatedClient(alias) });
}

export async function listSites(alias: AccountAlias) {
  const sc = await getSearchConsole(alias);
  const res = await sc.sites.list();
  return res.data.siteEntry ?? [];
}

export async function querySearchAnalytics(
  alias: AccountAlias,
  siteUrl: string,
  options: {
    startDate: string;
    endDate: string;
    dimensions?: string[];
    rowLimit?: number;
    filters?: { dimension: string; operator: string; expression: string }[];
  }
) {
  const sc = await getSearchConsole(alias);
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: options.dimensions ?? ["query"],
      rowLimit: options.rowLimit ?? 25,
      dimensionFilterGroups: options.filters
        ? [{ filters: options.filters }]
        : undefined,
    },
  });
  return res.data.rows ?? [];
}

export async function getSitemaps(alias: AccountAlias, siteUrl: string) {
  const sc = await getSearchConsole(alias);
  const res = await sc.sitemaps.list({ siteUrl });
  return res.data.sitemap ?? [];
}

export async function submitSitemap(alias: AccountAlias, siteUrl: string, feedpath: string) {
  const sc = await getSearchConsole(alias);
  await sc.sitemaps.submit({ siteUrl, feedpath });
  return { ok: true, feedpath };
}
