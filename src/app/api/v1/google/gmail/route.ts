import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateGoogleRequest } from "@/lib/google/auth-middleware";
import {
  searchMessages,
  getThread,
  getMessage,
  createDraft,
  sendEmail,
  sendDraft,
  deleteDraft,
  listDrafts,
  listLabels,
  modifyLabels,
  trashMessage,
} from "@/lib/google/gmail";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["search", "thread", "message", "labels", "drafts"]).default("search"),
  q: z.string().optional().default("in:inbox"),
  max: z.coerce.number().int().positive().max(500).optional().default(20),
  threadId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
});

const attachmentSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().min(1),  // base64-encoded file content
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    account: z.string().optional(),
    to: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    inReplyTo: z.string().optional(),
    threadId: z.string().optional(),
    attachments: z.array(attachmentSchema).optional(),
  }),
  z.object({
    action: z.literal("send"),
    account: z.string().optional(),
    to: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
    cc: z.string().optional(),
    bcc: z.string().optional(),
    inReplyTo: z.string().optional(),
    threadId: z.string().optional(),
    attachments: z.array(attachmentSchema).optional(),
  }),
  z.object({
    action: z.literal("send_draft"),
    account: z.string().optional(),
    draftId: z.string().min(1),
  }),
  z.object({
    action: z.literal("delete_draft"),
    account: z.string().optional(),
    draftId: z.string().min(1),
  }),
  z.object({
    action: z.literal("modify_labels"),
    account: z.string().optional(),
    messageId: z.string().min(1),
    addLabelIds: z.array(z.string()).optional(),
    removeLabelIds: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("trash"),
    account: z.string().optional(),
    messageId: z.string().min(1),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, q, max, threadId, messageId } = parsed.data;

  try {
    switch (action) {
      case "search": {
        const messages = await searchMessages(auth.account, q, max);
        return NextResponse.json({ messages });
      }

      case "thread": {
        if (!threadId)
          return NextResponse.json(
            { error: "threadId required" },
            { status: 400 }
          );
        const thread = await getThread(auth.account, threadId);
        return NextResponse.json(thread);
      }

      case "message": {
        if (!messageId)
          return NextResponse.json(
            { error: "messageId required" },
            { status: 400 }
          );
        const message = await getMessage(auth.account, messageId);
        return NextResponse.json(message);
      }

      case "labels": {
        const labels = await listLabels(auth.account);
        return NextResponse.json({ labels });
      }

      case "drafts": {
        const drafts = await listDrafts(auth.account, max);
        return NextResponse.json({ drafts });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Gmail API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const auth = authenticateGoogleRequest(request, body.account);
  if (auth instanceof NextResponse) return auth;

  try {
    switch (data.action) {
      case "draft": {
        const result = await createDraft(
          auth.account,
          data.to,
          data.subject,
          data.body,
          data.cc,
          data.bcc,
          data.inReplyTo,
          data.threadId,
          data.attachments
        );
        return NextResponse.json(result);
      }

      case "send": {
        const result = await sendEmail(
          auth.account,
          data.to,
          data.subject,
          data.body,
          data.cc,
          data.bcc,
          data.inReplyTo,
          data.threadId,
          data.attachments
        );
        return NextResponse.json(result);
      }

      case "send_draft": {
        const result = await sendDraft(auth.account, data.draftId);
        return NextResponse.json(result);
      }

      case "delete_draft": {
        await deleteDraft(auth.account, data.draftId);
        return NextResponse.json({ ok: true });
      }

      case "modify_labels": {
        await modifyLabels(
          auth.account,
          data.messageId,
          data.addLabelIds,
          data.removeLabelIds
        );
        return NextResponse.json({ ok: true });
      }

      case "trash": {
        await trashMessage(auth.account, data.messageId);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Gmail API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
