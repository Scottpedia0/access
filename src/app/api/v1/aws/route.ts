import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidGlobalAgentToken } from "@/lib/env";
import {
  listBuckets,
  listObjects,
  listInstances,
  listFunctions,
  invokeFunction,
  listLogGroups,
  getLogEvents,
} from "@/lib/aws/client";

export const runtime = "nodejs";

const getSchema = z.object({
  action: z.enum(["s3_buckets", "s3_objects", "ec2_instances", "lambda_functions", "logs"]),
  bucket: z.string().min(1).optional(),
  prefix: z.string().optional(),
  region: z.string().optional(),
  logGroup: z.string().optional(),
  logStream: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
});

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("lambda_invoke"),
    functionName: z.string().min(1),
    payload: z.string().default("{}"),
    region: z.string().optional(),
  }),
]);

function auth(request: NextRequest): NextResponse | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !isValidGlobalAgentToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = getSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { action, bucket, prefix, region, logGroup, logStream, limit } = parsed.data;

  try {
    switch (action) {
      case "s3_buckets":
        return NextResponse.json(await listBuckets());
      case "s3_objects": {
        if (!bucket) return NextResponse.json({ error: "bucket required" }, { status: 400 });
        return NextResponse.json(await listObjects(bucket, prefix));
      }
      case "ec2_instances":
        return NextResponse.json(await listInstances(region));
      case "lambda_functions":
        return NextResponse.json(await listFunctions(region));
      case "logs": {
        if (!logGroup) {
          return NextResponse.json(await listLogGroups());
        }
        return NextResponse.json(await getLogEvents(logGroup, logStream, limit));
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: "AWS API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = auth(request);
  if (denied) return denied;

  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  try {
    switch (data.action) {
      case "lambda_invoke":
        return NextResponse.json(await invokeFunction(data.functionName, data.payload, data.region));
    }
  } catch (err) {
    return NextResponse.json(
      { error: "AWS API error", details: process.env.NODE_ENV === "development" ? String(err) : "An internal error occurred" },
      { status: 500 },
    );
  }
}
