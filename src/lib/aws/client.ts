/**
 * AWS service client for the Access proxy.
 *
 * Optional adapter — install whichever SDK packages you need:
 *   npm install @aws-sdk/client-s3 @aws-sdk/client-ec2 \
 *               @aws-sdk/client-lambda @aws-sdk/client-cloudwatch-logs
 *
 * Env vars:
 *   AWS_ACCESS_KEY_ID     — IAM access key
 *   AWS_SECRET_ACCESS_KEY — IAM secret key
 *   AWS_REGION            — default region (falls back to us-east-1)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function regionOrDefault(override?: string): string {
  return override || process.env.AWS_REGION || "us-east-1";
}

function assertCreds() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set");
  }
}

async function loadModule(pkg: string): Promise<any> {
  try {
    return await (Function(`return import("${pkg}")`)() as Promise<any>);
  } catch {
    throw new Error(`AWS SDK package "${pkg}" not installed. Run: npm install ${pkg}`);
  }
}

// -- S3 --------------------------------------------------------------------

export async function listBuckets() {
  assertCreds();
  const { S3Client, ListBucketsCommand } = await loadModule("@aws-sdk/client-s3");
  const client = new S3Client({ region: regionOrDefault() });
  return client.send(new ListBucketsCommand({}));
}

export async function listObjects(bucket: string, prefix?: string) {
  assertCreds();
  const { S3Client, ListObjectsV2Command } = await loadModule("@aws-sdk/client-s3");
  const client = new S3Client({ region: regionOrDefault() });
  return client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      MaxKeys: 100,
    }),
  );
}

// -- EC2 -------------------------------------------------------------------

export async function listInstances(region?: string) {
  assertCreds();
  const { EC2Client, DescribeInstancesCommand } = await loadModule("@aws-sdk/client-ec2");
  const client = new EC2Client({ region: regionOrDefault(region) });
  return client.send(new DescribeInstancesCommand({}));
}

// -- Lambda ----------------------------------------------------------------

export async function listFunctions(region?: string) {
  assertCreds();
  const { LambdaClient, ListFunctionsCommand } = await loadModule("@aws-sdk/client-lambda");
  const client = new LambdaClient({ region: regionOrDefault(region) });
  return client.send(new ListFunctionsCommand({}));
}

export async function invokeFunction(functionName: string, payload: string, region?: string) {
  assertCreds();
  const { LambdaClient, InvokeCommand } = await loadModule("@aws-sdk/client-lambda");
  const client = new LambdaClient({ region: regionOrDefault(region) });
  const result = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: new TextEncoder().encode(payload),
    }),
  );
  return {
    statusCode: result.StatusCode,
    functionError: result.FunctionError,
    payload: result.Payload ? new TextDecoder().decode(result.Payload) : null,
  };
}

// -- CloudWatch Logs -------------------------------------------------------

export async function listLogGroups() {
  assertCreds();
  const { CloudWatchLogsClient, DescribeLogGroupsCommand } = await loadModule("@aws-sdk/client-cloudwatch-logs");
  const client = new CloudWatchLogsClient({ region: regionOrDefault() });
  return client.send(new DescribeLogGroupsCommand({ limit: 50 }));
}

export async function getLogEvents(
  logGroup: string,
  logStream?: string,
  limit = 50,
) {
  assertCreds();
  const {
    CloudWatchLogsClient,
    DescribeLogStreamsCommand,
    GetLogEventsCommand,
  } = await loadModule("@aws-sdk/client-cloudwatch-logs");
  const client = new CloudWatchLogsClient({ region: regionOrDefault() });

  let stream = logStream;
  if (!stream) {
    const streams = await client.send(
      new DescribeLogStreamsCommand({
        logGroupName: logGroup,
        orderBy: "LastEventTime",
        descending: true,
        limit: 1,
      }),
    );
    stream = streams.logStreams?.[0]?.logStreamName;
    if (!stream) throw new Error(`No log streams found in ${logGroup}`);
  }

  return client.send(
    new GetLogEventsCommand({
      logGroupName: logGroup,
      logStreamName: stream,
      limit: Math.min(limit, 100),
      startFromHead: false,
    }),
  );
}
