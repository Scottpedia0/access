import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  const auth = authenticateGoogleRequest(request);
  if (auth instanceof NextResponse) return auth;

  const action = request.nextUrl.searchParams.get("action") ?? "search";

  try {
    switch (action) {
      case "search": {
        const query = request.nextUrl.searchParams.get("q") ?? "in:inbox";
        const max = parseInt(
          request.nextUrl.searchParams.get("max") ?? "20",
          10
        );
        const messages = await searchMessages(auth.account, query, max);
        return NextResponse.json({ messages });
      }

      case "thread": {
        const threadId = request.nextUrl.searchParams.get("threadId");
        if (!threadId)
          return NextResponse.json(
            { error: "threadId required" },
            { status: 400 }
          );
        const thread = await getThread(auth.account, threadId);
        return NextResponse.json(thread);
      }

      case "message": {
        const messageId = request.nextUrl.searchParams.get("messageId");
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
        const max = parseInt(
          request.nextUrl.searchParams.get("max") ?? "20",
          10
        );
        const drafts = await listDrafts(auth.account, max);
        return NextResponse.json({ drafts });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
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
  const auth = authenticateGoogleRequest(request, body.account);
  if (auth instanceof NextResponse) return auth;
  const action = body.action;

  try {
    switch (action) {
      case "draft": {
        const result = await createDraft(
          auth.account,
          body.to,
          body.subject,
          body.body,
          body.cc,
          body.bcc,
          body.inReplyTo,
          body.threadId,
          body.attachments
        );
        return NextResponse.json(result);
      }

      case "send": {
        const result = await sendEmail(
          auth.account,
          body.to,
          body.subject,
          body.body,
          body.cc,
          body.bcc,
          body.inReplyTo,
          body.threadId,
          body.attachments
        );
        return NextResponse.json(result);
      }

      case "send_draft": {
        if (!body.draftId)
          return NextResponse.json(
            { error: "draftId required" },
            { status: 400 }
          );
        const result = await sendDraft(auth.account, body.draftId);
        return NextResponse.json(result);
      }

      case "delete_draft": {
        if (!body.draftId)
          return NextResponse.json(
            { error: "draftId required" },
            { status: 400 }
          );
        await deleteDraft(auth.account, body.draftId);
        return NextResponse.json({ ok: true });
      }

      case "modify_labels": {
        await modifyLabels(
          auth.account,
          body.messageId,
          body.addLabelIds,
          body.removeLabelIds
        );
        return NextResponse.json({ ok: true });
      }

      case "trash": {
        await trashMessage(auth.account, body.messageId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Gmail API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 }
    );
  }
}
