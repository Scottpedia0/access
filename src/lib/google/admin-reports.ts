import { getAuthenticatedClient, type AccountAlias } from "./accounts";

type Scalar = string | number | boolean | null;

type RawParameter = {
  name?: string | null;
  value?: unknown;
  intValue?: unknown;
  boolValue?: unknown;
  multiValue?: unknown[];
};

type RawEvent = {
  type?: string | null;
  name?: string | null;
  parameters?: RawParameter[];
};

type RawActivity = {
  kind?: string | null;
  id?: Record<string, unknown> | null;
  actor?: { email?: string | null } | null;
  ownerDomain?: string | null;
  events?: RawEvent[];
};

type RawUsageReport = {
  kind?: string | null;
  date?: string | null;
  entity?: Record<string, unknown> | null;
  parameters?: RawParameter[];
};

type ActivitiesResponse = {
  kind?: string | null;
  etag?: string | null;
  nextPageToken?: string | null;
  items?: RawActivity[];
};

type UsageResponse = {
  kind?: string | null;
  etag?: string | null;
  nextPageToken?: string | null;
  usageReports?: RawUsageReport[];
  warnings?: Array<Record<string, unknown>>;
};

export type ActivityQuery = {
  applicationName: string;
  userKey?: string;
  maxResults?: number;
  startTime?: string;
  endTime?: string;
  eventName?: string;
  filters?: string;
  actorIpAddress?: string;
  customerId?: string;
  orgUnitId?: string;
  groupIdFilter?: string;
  pageToken?: string;
};

export type UsageQuery = {
  userKey?: string;
  date: string;
  maxResults?: number;
  parameters?: string;
  pageToken?: string;
};

function asScalar(value: unknown): Scalar {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

function normalizeParameters(
  parameters?: RawParameter[]
): Record<string, Scalar | Scalar[]> {
  const entries = parameters ?? [];
  const out: Record<string, Scalar | Scalar[]> = {};

  for (const parameter of entries) {
    const name = parameter.name;
    if (!name) continue;

    if (Array.isArray(parameter.multiValue) && parameter.multiValue.length > 0) {
      out[name] = parameter.multiValue.map(asScalar);
      continue;
    }

    const raw =
      parameter.value ??
      parameter.intValue ??
      parameter.boolValue ??
      null;

    out[name] = asScalar(raw);
  }

  return out;
}

function normalizeActivities(items?: RawActivity[]) {
  return (items ?? []).map((item) => {
    const firstEventParameters = item.events?.[0]?.parameters ?? [];
    const actorParameters = normalizeParameters(firstEventParameters);
    const ipAddress =
      actorParameters.ipAddress ??
      actorParameters.callerIp ??
      actorParameters.ip_address ??
      null;

    return {
      kind: item.kind ?? null,
      id: item.id ?? null,
      actorEmail: item.actor?.email ?? null,
      ipAddress,
      ownerDomain: item.ownerDomain ?? null,
      events: (item.events ?? []).map((event) => ({
        type: event.type ?? null,
        name: event.name ?? null,
        parameters: normalizeParameters(event.parameters),
      })),
    };
  });
}

function normalizeUsage(items?: RawUsageReport[]) {
  return (items ?? []).map((item) => ({
    kind: item.kind ?? null,
    date: item.date ?? null,
    entity: item.entity ?? null,
    parameters: normalizeParameters(item.parameters),
  }));
}

async function getAccessToken(alias: AccountAlias) {
  const auth = await getAuthenticatedClient(alias);
  const tokenResult = await auth.getAccessToken();
  const accessToken =
    typeof tokenResult === "string" ? tokenResult : tokenResult?.token;

  if (!accessToken) {
    throw new Error(`Failed to get access token for ${alias}`);
  }

  return accessToken;
}

async function fetchAdminJson<T>(
  alias: AccountAlias,
  path: string,
  params: Record<string, string | undefined>
): Promise<T> {
  const accessToken = await getAccessToken(alias);
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }

  const url = `https://admin.googleapis.com${path}?${search.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = (await res.json()) as T | { error?: { message?: string } };

  if (!res.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      body.error?.message
        ? body.error.message
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return body as T;
}

export async function listActivities(alias: AccountAlias, query: ActivityQuery) {
  const response = await fetchAdminJson<ActivitiesResponse>(
    alias,
    `/admin/reports/v1/activity/users/${encodeURIComponent(
      query.userKey ?? "all"
    )}/applications/${encodeURIComponent(query.applicationName)}`,
    {
      maxResults: String(query.maxResults ?? 100),
      startTime: query.startTime,
      endTime: query.endTime,
      eventName: query.eventName,
      filters: query.filters,
      actorIpAddress: query.actorIpAddress,
      customerId: query.customerId,
      orgUnitID: query.orgUnitId,
      groupIdFilter: query.groupIdFilter,
      pageToken: query.pageToken,
    }
  );

  return {
    kind: response.kind ?? null,
    etag: response.etag ?? null,
    nextPageToken: response.nextPageToken ?? null,
    items: normalizeActivities(response.items),
  };
}

export async function getUserUsageReport(alias: AccountAlias, query: UsageQuery) {
  const response = await fetchAdminJson<UsageResponse>(
    alias,
    `/admin/reports/v1/usage/users/${encodeURIComponent(
      query.userKey ?? "all"
    )}/dates/${encodeURIComponent(query.date)}`,
    {
      maxResults: String(query.maxResults ?? 100),
      parameters: query.parameters,
      pageToken: query.pageToken,
    }
  );

  return {
    kind: response.kind ?? null,
    etag: response.etag ?? null,
    nextPageToken: response.nextPageToken ?? null,
    usageReports: normalizeUsage(response.usageReports),
    warnings: response.warnings ?? [],
  };
}
