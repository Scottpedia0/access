import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getDocs(alias: AccountAlias) {
  return google.docs({ version: "v1", auth: await getAuthenticatedClient(alias) });
}

export async function getDocument(alias: AccountAlias, documentId: string) {
  const docs = await getDocs(alias);
  const res = await docs.documents.get({ documentId });
  return res.data;
}

export async function getDocumentText(alias: AccountAlias, documentId: string): Promise<string> {
  const doc = await getDocument(alias, documentId);
  const text: string[] = [];

  for (const element of doc.body?.content ?? []) {
    if (element.paragraph) {
      for (const pe of element.paragraph.elements ?? []) {
        if (pe.textRun?.content) text.push(pe.textRun.content);
      }
    }
    if (element.table) {
      for (const row of element.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          for (const cellEl of cell.content ?? []) {
            if (cellEl.paragraph) {
              for (const pe of cellEl.paragraph.elements ?? []) {
                if (pe.textRun?.content) text.push(pe.textRun.content);
              }
            }
          }
        }
      }
    }
  }

  return text.join("");
}

export async function appendText(alias: AccountAlias, documentId: string, text: string) {
  const docs = await getDocs(alias);
  const res = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [{ insertText: { location: { index: 1 }, text } }],
    },
  });
  return res.data;
}
