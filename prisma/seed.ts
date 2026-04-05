import "dotenv/config";

import {
  ConsumerKind,
  PrismaClient,
  ResourceType,
  RiskLevel,
  ServiceStatus,
  VisibilityMode,
} from "@prisma/client";
import { createCipheriv, createHmac, randomBytes } from "crypto";

const prisma = new PrismaClient();

const ownerOnly = VisibilityMode.OWNER_ONLY;

function getEncryptionKey() {
  const raw = process.env.SECRET_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("SECRET_ENCRYPTION_KEY is required for seeding.");
  }

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) {
    return base64;
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error("SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.");
}

function encryptSecretValue(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function hashConsumerToken(token: string) {
  const secret = process.env.CONSUMER_TOKEN_HASH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("CONSUMER_TOKEN_HASH_SECRET or NEXTAUTH_SECRET is required for seeding.");
  }

  return createHmac("sha256", secret).update(token).digest("hex");
}

function issueConsumerToken() {
  const tokenPrefix = `amb_live_${randomBytes(6).toString("hex")}`;
  const token = `${tokenPrefix}_${randomBytes(24).toString("base64url")}`;

  return { token, tokenPrefix };
}

async function ensureResource(serviceId: string, label: string, resourceType: ResourceType, pathOrUrl: string, notes: string) {
  const existing = await prisma.linkedResource.findFirst({
    where: {
      serviceId,
      label,
      pathOrUrl,
    },
  });

  if (!existing) {
    await prisma.linkedResource.create({
      data: {
        serviceId,
        label,
        resourceType,
        pathOrUrl,
        notes,
      },
    });
  }
}

async function ensureSecret(data: {
  serviceId: string;
  label: string;
  envVarName: string;
  description: string;
  category: string;
  notes: string;
}) {
  const existing = await prisma.secret.findUnique({
    where: {
      envVarName: data.envVarName,
    },
  });

  if (!existing) {
    await prisma.secret.create({
      data: {
        ...data,
        encryptedValue: encryptSecretValue(`replace-me-${data.envVarName.toLowerCase()}`),
        visibilityMode: ownerOnly,
        active: true,
        deprecated: false,
      },
    });
  }
}

async function main() {
  const services = [
    {
      name: "OpenRouter",
      slug: "openrouter",
      description: "Primary routing layer for multi-model experiments and agent workflows.",
      category: "AI model routing",
      tags: ["models", "agent", "routing"],
      riskLevel: RiskLevel.MEDIUM,
      notesSummary:
        "Useful for local scripts that need flexible access to many frontier and budget models.",
      status: ServiceStatus.ACTIVE,
      visibilityMode: ownerOnly,
      docTitle: "OpenRouter Notes",
      docBody: [
        "# OpenRouter Notes",
        "",
        "- Primary use: route agent and experiment traffic without rewriting each tool for every model vendor.",
        "- Keep cost/rate-limit notes here as Scott learns them.",
        "- Default posture: owner only until explicit grants are set.",
      ].join("\n"),
      resources: [
        {
          label: "OpenRouter skill",
          resourceType: ResourceType.SKILL,
          pathOrUrl: "/path/to/skills",
          notes: "Link the concrete OpenRouter skill path when one exists.",
        },
      ],
      secrets: [
        {
          label: "Primary API key",
          envVarName: "OPENROUTER_API_KEY",
          description: "Main OpenRouter key for agent and local tool use.",
          category: "api_key",
          notes: "Bounded-risk key suitable for trusted agent workflows.",
        },
      ],
    },
    {
      name: "Vercel",
      slug: "vercel",
      description: "Deployment target for apps and operator tools.",
      category: "deployments",
      tags: ["deploy", "hosting", "frontend"],
      riskLevel: RiskLevel.MEDIUM,
      notesSummary: "Useful for deploy automation, environment setup, and preview links.",
      status: ServiceStatus.ACTIVE,
      visibilityMode: ownerOnly,
      docTitle: "Vercel Deploy Notes",
      docBody: [
        "# Vercel Deploy Notes",
        "",
        "- Access can deploy here with Postgres + Auth.js env vars.",
        "- Point Netlify-managed DNS to the Vercel target when production is ready.",
      ].join("\n"),
      resources: [
        {
          label: "Vercel dashboard",
          resourceType: ResourceType.URL,
          pathOrUrl: "https://vercel.com/dashboard",
          notes: "Production and preview deployment control plane.",
        },
      ],
      secrets: [
        {
          label: "Personal token",
          envVarName: "VERCEL_TOKEN",
          description: "Personal token for deploy automation and scripts.",
          category: "token",
          notes: "Use for CLI deploys and automation only.",
        },
      ],
    },
    {
      name: "HubSpot",
      slug: "hubspot",
      description: "CRM system for sales workflows.",
      category: "crm",
      tags: ["sales", "crm", "qualified"],
      riskLevel: RiskLevel.MEDIUM,
      notesSummary:
        "Good candidate for selective secret grants rather than broad trusted-agent access.",
      status: ServiceStatus.ACTIVE,
      visibilityMode: ownerOnly,
      docTitle: "HubSpot Notes",
      docBody: [
        "# HubSpot Notes",
        "",
        "- Keep private app token usage and workflow caveats here.",
        "- Prefer scoped access for the specific tools that need HubSpot reads/writes.",
      ].join("\n"),
      resources: [
        {
          label: "Review app path",
          resourceType: ResourceType.REPO_PATH,
          pathOrUrl: "/path/to/project",
          notes: "Home for the warm pipeline tooling.",
        },
      ],
      secrets: [
        {
          label: "Private app token",
          envVarName: "HUBSPOT_PRIVATE_APP_TOKEN",
          description: "HubSpot private app token for CRM operations.",
          category: "token",
          notes: "Grant selectively to tools that truly need HubSpot access.",
        },
      ],
    },
  ];

  const serviceMap = new Map<string, string>();

  for (const service of services) {
    const record = await prisma.service.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        description: service.description,
        category: service.category,
        tags: service.tags,
        riskLevel: service.riskLevel,
        notesSummary: service.notesSummary,
        status: service.status,
        visibilityMode: service.visibilityMode,
      },
      create: {
        name: service.name,
        slug: service.slug,
        description: service.description,
        category: service.category,
        tags: service.tags,
        riskLevel: service.riskLevel,
        notesSummary: service.notesSummary,
        status: service.status,
        visibilityMode: service.visibilityMode,
      },
    });

    serviceMap.set(service.slug, record.id);

    await prisma.serviceDoc.upsert({
      where: {
        serviceId_title: {
          serviceId: record.id,
          title: service.docTitle,
        },
      },
      update: {
        markdownBody: service.docBody,
      },
      create: {
        serviceId: record.id,
        title: service.docTitle,
        markdownBody: service.docBody,
      },
    });

    for (const resource of service.resources) {
      await ensureResource(
        record.id,
        resource.label,
        resource.resourceType,
        resource.pathOrUrl,
        resource.notes,
      );
    }

    for (const secret of service.secrets) {
      await ensureSecret({
        serviceId: record.id,
        ...secret,
      });
    }
  }

  const existingMoe = await prisma.consumer.findUnique({
    where: { slug: "example-agent" },
  });

  if (!existingMoe) {
    const tokenData = issueConsumerToken();
    const moe = await prisma.consumer.create({
      data: {
        name: "example-agent",
        slug: "example-agent",
        kind: ConsumerKind.TRUSTED_AGENT,
        isTrusted: true,
        active: true,
        notes: "Example trusted operator agent.",
        tokenPrefix: tokenData.tokenPrefix,
        tokenHash: hashConsumerToken(tokenData.token),
        lastIssuedAt: new Date(),
      },
    });

    const openRouterId = serviceMap.get("openrouter");
    const vercelId = serviceMap.get("vercel");

    if (openRouterId) {
      await prisma.accessGrant.upsert({
        where: {
          consumerId_serviceId: {
            consumerId: moe.id,
            serviceId: openRouterId,
          },
        },
        update: {
          canReadMetadata: true,
          canReadDocs: true,
          canReadSecrets: true,
          active: true,
        },
        create: {
          consumerId: moe.id,
          serviceId: openRouterId,
          canReadMetadata: true,
          canReadDocs: true,
          canReadSecrets: true,
          active: true,
        },
      });
    }

    if (vercelId) {
      await prisma.accessGrant.upsert({
        where: {
          consumerId_serviceId: {
            consumerId: moe.id,
            serviceId: vercelId,
          },
        },
        update: {
          canReadMetadata: true,
          canReadDocs: true,
          canReadSecrets: true,
          active: true,
        },
        create: {
          consumerId: moe.id,
          serviceId: vercelId,
          canReadMetadata: true,
          canReadDocs: true,
          canReadSecrets: true,
          active: true,
        },
      });
    }

    console.log("\nSeeded consumer token (shown once):");
    console.log(`Moe: ${tokenData.token}\n`);
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
