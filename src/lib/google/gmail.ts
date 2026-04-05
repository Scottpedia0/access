import { google } from "googleapis";
import { getAuthenticatedClient, type AccountAlias } from "./accounts";

async function getGmail(alias: AccountAlias) {
  return google.gmail({ version: "v1", auth: await getAuthenticatedClient(alias) });
}

export async function searchMessages(
  alias: AccountAlias,
  query: string,
  maxResults = 20
) {
  const gmail = await getGmail(alias);
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  if (!res.data.messages?.length) return [];

  const messages = await Promise.all(
    res.data.messages.map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });

      const headers = full.data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";

      return {
        id: full.data.id,
        threadId: full.data.threadId,
        snippet: full.data.snippet,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        labelIds: full.data.labelIds,
      };
    })
  );

  return messages;
}

export async function getThread(alias: AccountAlias, threadId: string) {
  const gmail = await getGmail(alias);
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  });

  return {
    id: res.data.id,
    messages: (res.data.messages ?? []).map((msg) => {
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";

      let body = "";
      if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, "base64url").toString(
          "utf-8"
        );
      } else if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(
          (p) => p.mimeType === "text/plain"
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64url").toString(
            "utf-8"
          );
        }
      }

      return {
        id: msg.id,
        from: getHeader("From"),
        to: getHeader("To"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        snippet: msg.snippet,
        body,
        labelIds: msg.labelIds,
      };
    }),
  };
}

export async function getMessage(alias: AccountAlias, messageId: string) {
  const gmail = await getGmail(alias);
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    "";

  let body = "";
  if (res.data.payload?.body?.data) {
    body = Buffer.from(res.data.payload.body.data, "base64url").toString(
      "utf-8"
    );
  } else if (res.data.payload?.parts) {
    const textPart = res.data.payload.parts.find(
      (p) => p.mimeType === "text/plain"
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    }
  }

  return {
    id: res.data.id,
    threadId: res.data.threadId,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    snippet: res.data.snippet,
    body,
    labelIds: res.data.labelIds,
  };
}

interface Attachment {
  filename: string;
  mimeType: string;
  data: string; // base64-encoded file content
}

function buildMimeMessage(
  headers: string[],
  body: string,
  attachments?: Attachment[]
): string {
  if (!attachments?.length) {
    headers.push(`Content-Type: text/plain; charset="UTF-8"`);
    return headers.join("\r\n") + "\r\n\r\n" + body;
  }

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  let mime = headers.join("\r\n") + "\r\n\r\n";
  mime += `--${boundary}\r\n`;
  mime += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
  mime += body + "\r\n";

  for (const att of attachments) {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
    mime += `Content-Transfer-Encoding: base64\r\n\r\n`;
    mime += att.data + "\r\n";
  }

  mime += `--${boundary}--`;
  return mime;
}

export async function createDraft(
  alias: AccountAlias,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  inReplyTo?: string,
  threadId?: string,
  attachments?: Attachment[]
) {
  const gmail = await getGmail(alias);

  const headers = [`To: ${to}`, `Subject: ${subject}`];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const mime = buildMimeMessage(headers, body, attachments);
  const raw = Buffer.from(mime).toString("base64url");

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw,
        threadId: threadId ?? undefined,
      },
    },
  });

  return { draftId: res.data.id, messageId: res.data.message?.id };
}

export async function sendEmail(
  alias: AccountAlias,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  inReplyTo?: string,
  threadId?: string,
  attachments?: Attachment[]
) {
  const gmail = await getGmail(alias);

  const headers = [`To: ${to}`, `Subject: ${subject}`];
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
    headers.push(`References: ${inReplyTo}`);
  }

  const mime = buildMimeMessage(headers, body, attachments);
  const raw = Buffer.from(mime).toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: threadId ?? undefined,
    },
  });

  return { messageId: res.data.id, threadId: res.data.threadId };
}

export async function sendDraft(alias: AccountAlias, draftId: string) {
  const gmail = await getGmail(alias);
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });
  return { messageId: res.data.id, threadId: res.data.threadId };
}

export async function deleteDraft(alias: AccountAlias, draftId: string) {
  const gmail = await getGmail(alias);
  await gmail.users.drafts.delete({ userId: "me", id: draftId });
}

export async function listDrafts(alias: AccountAlias, maxResults = 20) {
  const gmail = await getGmail(alias);
  const res = await gmail.users.drafts.list({ userId: "me", maxResults });
  if (!res.data.drafts?.length) return [];

  const drafts = await Promise.all(
    res.data.drafts.map(async (d) => {
      const full = await gmail.users.drafts.get({
        userId: "me",
        id: d.id!,
        format: "metadata",
      });
      const headers = full.data.message?.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";
      return {
        draftId: full.data.id,
        messageId: full.data.message?.id,
        threadId: full.data.message?.threadId,
        to: getHeader("To"),
        subject: getHeader("Subject"),
        snippet: full.data.message?.snippet,
      };
    })
  );
  return drafts;
}

export async function listLabels(alias: AccountAlias) {
  const gmail = await getGmail(alias);
  const res = await gmail.users.labels.list({ userId: "me" });
  return res.data.labels ?? [];
}

export async function modifyLabels(
  alias: AccountAlias,
  messageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[]
) {
  const gmail = await getGmail(alias);
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: addLabelIds ?? [],
      removeLabelIds: removeLabelIds ?? [],
    },
  });
}

export async function trashMessage(alias: AccountAlias, messageId: string) {
  const gmail = await getGmail(alias);
  await gmail.users.messages.trash({ userId: "me", id: messageId });
}
