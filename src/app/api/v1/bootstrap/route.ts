import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticateRequestActor,
  canReadSecret,
  canReadServiceDocs,
  canReadServiceMetadata,
} from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { decryptSecretValue } from "@/lib/security/encryption";

export async function GET(request: NextRequest) {
  const actor = await authenticateRequestActor(request);

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedSlugs = request.nextUrl.searchParams
    .get("services")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const services = await prisma.service.findMany({
    where: requestedSlugs?.length
      ? {
          slug: {
            in: requestedSlugs,
          },
        }
      : undefined,
    include: {
      docs: true,
      linkedResources: true,
      secrets: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const includedServices = services
    .map((service) => {
      const metadataAllowed = canReadServiceMetadata(actor, service);
      const docsAllowed = canReadServiceDocs(actor, service);
      const secrets = service.secrets.filter((secret) => canReadSecret(actor, secret));

      if (!metadataAllowed && !docsAllowed && secrets.length === 0) {
        return null;
      }

      return {
        serviceId: service.id,
        slug: service.slug,
        metadataAllowed,
        docsAllowed,
        service: {
          id: service.id,
          name: service.name,
          slug: service.slug,
          description: metadataAllowed ? service.description : "",
          category: metadataAllowed ? service.category : "",
          tags: metadataAllowed ? service.tags : [],
          riskLevel: metadataAllowed ? service.riskLevel : null,
          notesSummary: metadataAllowed ? service.notesSummary : "",
          status: metadataAllowed ? service.status : null,
          visibilityMode: metadataAllowed ? service.visibilityMode : null,
          updatedAt: service.updatedAt,
        },
        docs: docsAllowed
          ? service.docs.map((doc) => ({
              id: doc.id,
              title: doc.title,
              markdownBody: doc.markdownBody,
              updatedAt: doc.updatedAt,
            }))
          : [],
        linkedResources: docsAllowed
          ? service.linkedResources.map((resource) => ({
              id: resource.id,
              label: resource.label,
              resourceType: resource.resourceType,
              pathOrUrl: resource.pathOrUrl,
              notes: resource.notes,
            }))
          : [],
        secrets: secrets.map((secret) => ({
          id: secret.id,
          label: secret.label,
          envVarName: secret.envVarName,
          value: decryptSecretValue(secret.encryptedValue),
          description: secret.description,
          updatedAt: secret.updatedAt,
        })),
      };
    })
    .filter((service): service is NonNullable<typeof service> => Boolean(service));

  if (actor.kind === "consumer") {
    await prisma.consumer.update({
      where: { id: actor.consumer.id },
      data: { lastUsedAt: new Date() },
    });
  }

  for (const service of includedServices) {
    if (service.metadataAllowed || service.docs.length > 0) {
    await createAuditEvent({
      actor: actor.auditActor,
      action: AuditAction.SERVICE_METADATA_RETRIEVED,
      serviceId: service.serviceId,
      consumerId: actor.kind === "consumer" ? actor.consumer.id : null,
      metadataJson: {
        slug: service.slug,
        includeDocs: service.docs.length > 0,
        bootstrap: true,
        globalAccess: actor.kind === "global",
      },
    });
    }

    if (service.secrets.length > 0) {
      await createAuditEvent({
        actor: actor.auditActor,
        action: AuditAction.SERVICE_SECRETS_RETRIEVED,
        serviceId: service.serviceId,
        consumerId: actor.kind === "consumer" ? actor.consumer.id : null,
        metadataJson: {
          slug: service.slug,
          count: service.secrets.length,
          bootstrap: true,
          globalAccess: actor.kind === "global",
        },
      });
    }
  }

  return NextResponse.json({
    actor:
      actor.kind === "consumer"
        ? {
            kind: "consumer",
            id: actor.consumer.id,
            name: actor.consumer.name,
            slug: actor.consumer.slug,
          }
        : actor.kind === "global"
          ? {
              kind: "global",
              label: "Global agent token",
            }
        : {
            kind: "user",
          },
    env: Object.fromEntries(
      includedServices.flatMap((service) =>
        service.secrets.map((secret) => [secret.envVarName, secret.value]),
      ),
    ),
    services: includedServices.map(({ service, docs, linkedResources, secrets }) => ({
      service,
      docs,
      linkedResources,
      secrets,
    })),
    fetchedAt: new Date().toISOString(),
  });
}
