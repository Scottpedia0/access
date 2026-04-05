import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getDrive(alias: AccountAlias) {
  return google.drive({ version: "v3", auth: await getAuthenticatedClient(alias) });
}

export async function searchFiles(alias: AccountAlias, query: string, maxResults = 20) {
  const drive = await getDrive(alias);
  const res = await drive.files.list({
    q: query,
    pageSize: maxResults,
    fields: "files(id, name, mimeType, modifiedTime, webViewLink, parents, size)",
  });
  return res.data.files ?? [];
}

export async function getFile(alias: AccountAlias, fileId: string) {
  const drive = await getDrive(alias);
  const res = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, modifiedTime, webViewLink, parents, size, description",
  });
  return res.data;
}

export async function getFileContent(alias: AccountAlias, fileId: string, mimeType: string) {
  const drive = await getDrive(alias);
  const res = await drive.files.export({ fileId, mimeType }, { responseType: "text" });
  return res.data;
}

export async function listFolder(alias: AccountAlias, folderId = "root", maxResults = 50) {
  const drive = await getDrive(alias);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: maxResults,
    fields: "files(id, name, mimeType, modifiedTime, webViewLink, size)",
    orderBy: "modifiedTime desc",
  });
  return res.data.files ?? [];
}
