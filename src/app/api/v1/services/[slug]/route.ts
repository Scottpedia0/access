import { AuditAction } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  authenticateRequestActor,
  canReadServiceDocs,
  canReadServiceMetadata,
} from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const actor = await authenticateRequestActor(request);

  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const service = await prisma.service.findUnique({
    where: { slug },
    include: {
      docs: true,
      linkedResources: true,
      secrets: {
        select: {
          id: true,
          envVarName: true,
        },
      },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (!canReadServiceMetadata(actor, service)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (actor.kind === "consumer") {
    await prisma.consumer.update({
      where: { id: actor.consumer.id },
      data: { lastUsedAt: new Date() },
    });
  }

  const includeDocs = canReadServiceDocs(actor, service);

  await createAuditEvent({
    actor: actor.auditActor,
    action: AuditAction.SERVICE_METADATA_RETRIEVED,
    serviceId: service.id,
    consumerId: actor.kind === "consumer" ? actor.consumer.id : null,
    metadataJson: {
      slug: service.slug,
      includeDocs,
      globalAccess: actor.kind === "global",
    },
  });

  return NextResponse.json({
    service: {
      id: service.id,
      name: service.name,
      slug: service.slug,
      description: service.description,
      category: service.category,
      tags: service.tags,
      riskLevel: service.riskLevel,
      notesSummary: service.notesSummary,
      status: service.status,
      visibilityMode: service.visibilityMode,
      updatedAt: service.updatedAt,
      envVarNames: service.secrets.map((secret) => secret.envVarName),
    },
    docs: includeDocs
      ? service.docs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          markdownBody: doc.markdownBody,
          updatedAt: doc.updatedAt,
        }))
      : [],
    linkedResources: includeDocs
      ? service.linkedResources.map((resource) => ({
          id: resource.id,
          label: resource.label,
          resourceType: resource.resourceType,
          pathOrUrl: resource.pathOrUrl,
          notes: resource.notes,
        }))
      : [],
  });
}
