import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

const SCOPES = [
  // Gmail
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  // Calendar
  "https://www.googleapis.com/auth/calendar",
  // Contacts / People
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts",
  // Drive
  "https://www.googleapis.com/auth/drive",
  // Sheets
  "https://www.googleapis.com/auth/spreadsheets",
  // Docs
  "https://www.googleapis.com/auth/documents",
  // Slides
  "https://www.googleapis.com/auth/presentations",
  // Tasks
  "https://www.googleapis.com/auth/tasks",
  // Forms
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly",
  // Admin SDK
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",
  "https://www.googleapis.com/auth/admin.reports.usage.readonly",
  // YouTube
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.readonly",
  // Google Analytics
  "https://www.googleapis.com/auth/analytics.readonly",
  // Google Search Console
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/webmasters.readonly",
  // Google Ads
  "https://www.googleapis.com/auth/adwords",
  // Google Tag Manager
  "https://www.googleapis.com/auth/tagmanager.readonly",
  "https://www.googleapis.com/auth/tagmanager.edit.containers",
  // User profile info
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/**
 * Google account aliases are configured via the GOOGLE_ACCOUNTS env var.
 * Format: "alias1:email1,alias2:email2"
 * Example: GOOGLE_ACCOUNTS="work:me@company.com,personal:me@gmail.com"
 */
export type AccountAlias = string;

function parseAccountsFromEnv(): Record<string, string> {
  const raw = process.env.GOOGLE_ACCOUNTS ?? "";
  const accounts: Record<string, string> = {};

  for (const entry of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) continue;
    const alias = entry.slice(0, colonIndex).trim();
    const email = entry.slice(colonIndex + 1).trim();
    if (alias && email) {
      accounts[alias] = email;
    }
  }

  return accounts;
}

const ACCOUNT_EMAILS: Record<string, string> = parseAccountsFromEnv();

function getCallbackUrl(): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base}/api/google/callback`;
}

function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_BROKER_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BROKER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_BROKER_CLIENT_ID and GOOGLE_BROKER_CLIENT_SECRET must be set in env"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, getCallbackUrl());
}

export function getAuthUrl(alias: AccountAlias): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    login_hint: ACCOUNT_EMAILS[alias],
    state: alias,
  });
}

export async function handleCallback(
  code: string,
  alias: AccountAlias
): Promise<void> {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  await prisma.googleToken.upsert({
    where: { alias },
    update: {
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || undefined,
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || null,
      idToken: tokens.id_token || null,
    },
    create: {
      alias,
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date ? BigInt(tokens.expiry_date) : null,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || null,
      idToken: tokens.id_token || null,
    },
  });
}

export async function getAuthenticatedClient(
  alias: AccountAlias
): Promise<OAuth2Client> {
  const row = await prisma.googleToken.findUnique({ where: { alias } });

  if (!row) {
    throw new Error(
      `No tokens for account "${alias}". Visit /api/google/auth?account=${alias} to authorize.`
    );
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken,
    expiry_date: row.expiryDate ? Number(row.expiryDate) : undefined,
    scope: row.scope || undefined,
    token_type: row.tokenType || undefined,
    id_token: row.idToken || undefined,
  });

  client.on("tokens", async (newTokens) => {
    await prisma.googleToken.update({
      where: { alias },
      data: {
        accessToken: newTokens.access_token || row.accessToken,
        refreshToken: newTokens.refresh_token || row.refreshToken,
        expiryDate: newTokens.expiry_date
          ? BigInt(newTokens.expiry_date)
          : row.expiryDate,
        idToken: newTokens.id_token || row.idToken,
      },
    });
  });

  return client;
}

export function getAccountEmail(alias: AccountAlias): string {
  return ACCOUNT_EMAILS[alias];
}

export function isValidAlias(value: string): value is AccountAlias {
  return value in ACCOUNT_EMAILS;
}

export function getAccountAliases(): string[] {
  return Object.keys(ACCOUNT_EMAILS);
}

export async function getConnectedAccounts(): Promise<
  { alias: AccountAlias; email: string; connected: boolean }[]
> {
  const tokens = await prisma.googleToken.findMany({
    select: { alias: true },
  });
  const connectedAliases = new Set(tokens.map((t) => t.alias));

  return (Object.keys(ACCOUNT_EMAILS) as AccountAlias[]).map((alias) => ({
    alias,
    email: ACCOUNT_EMAILS[alias],
    connected: connectedAliases.has(alias),
  }));
}
