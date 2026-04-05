import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getSheets(alias: AccountAlias) {
  return google.sheets({ version: "v4", auth: await getAuthenticatedClient(alias) });
}

export async function getSpreadsheet(alias: AccountAlias, spreadsheetId: string) {
  const sheets = await getSheets(alias);
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return res.data;
}

export async function readRange(alias: AccountAlias, spreadsheetId: string, range: string) {
  const sheets = await getSheets(alias);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return res.data.values ?? [];
}

export async function writeRange(
  alias: AccountAlias,
  spreadsheetId: string,
  range: string,
  values: unknown[][]
) {
  const sheets = await getSheets(alias);
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
  return res.data;
}

export async function appendRows(
  alias: AccountAlias,
  spreadsheetId: string,
  range: string,
  values: unknown[][]
) {
  const sheets = await getSheets(alias);
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
  return res.data;
}
