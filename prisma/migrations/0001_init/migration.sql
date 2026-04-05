-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'DRAFT', 'PAUSED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "VisibilityMode" AS ENUM ('OWNER_ONLY', 'TRUSTED_AGENTS', 'SELECTED_CONSUMERS');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('URL', 'LOCAL_PATH', 'REPO_PATH', 'SKILL', 'INTERNAL_NOTE', 'AUTOMATION');

-- CreateEnum
CREATE TYPE "ConsumerKind" AS ENUM ('TRUSTED_AGENT', 'LOCAL_TOOL', 'REVIEW_APP', 'SCRIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'CONSUMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCEEDED', 'SERVICE_CREATED', 'SERVICE_UPDATED', 'SECRET_CREATED', 'SECRET_UPDATED', 'SECRET_REVEALED', 'SECRET_COPIED', 'SECRET_RETRIEVED', 'SERVICE_METADATA_RETRIEVED', 'SERVICE_SECRETS_RETRIEVED', 'DOC_CREATED', 'DOC_UPDATED', 'DOC_RETRIEVED', 'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'CONSUMER_CREATED', 'CONSUMER_UPDATED', 'CONSUMER_TOKEN_ROTATED', 'ACCESS_GRANTS_UPDATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "notesSummary" TEXT NOT NULL DEFAULT '',
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibilityMode" "VisibilityMode" NOT NULL DEFAULT 'OWNER_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "envVarName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "visibilityMode" "VisibilityMode" NOT NULL DEFAULT 'OWNER_ONLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastRevealedAt" TIMESTAMP(3),
    "lastRotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDoc" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "markdownBody" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedResource" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "pathOrUrl" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consumer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ConsumerKind" NOT NULL DEFAULT 'TRUSTED_AGENT',
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "tokenPrefix" TEXT,
    "tokenHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "lastIssuedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "consumerId" TEXT NOT NULL,
    "serviceId" TEXT,
    "secretId" TEXT,
    "canReadMetadata" BOOLEAN NOT NULL DEFAULT false,
    "canReadDocs" BOOLEAN NOT NULL DEFAULT false,
    "canReadSecrets" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorLabel" TEXT,
    "serviceId" TEXT,
    "secretId" TEXT,
    "consumerId" TEXT,
    "action" "AuditAction" NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_status_updatedAt_idx" ON "Service"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_envVarName_key" ON "Secret"("envVarName");

-- CreateIndex
CREATE INDEX "Secret_serviceId_updatedAt_idx" ON "Secret"("serviceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_serviceId_label_key" ON "Secret"("serviceId", "label");

-- CreateIndex
CREATE INDEX "ServiceDoc_serviceId_updatedAt_idx" ON "ServiceDoc"("serviceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDoc_serviceId_title_key" ON "ServiceDoc"("serviceId", "title");

-- CreateIndex
CREATE INDEX "LinkedResource_serviceId_updatedAt_idx" ON "LinkedResource"("serviceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_slug_key" ON "Consumer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_tokenPrefix_key" ON "Consumer"("tokenPrefix");

-- CreateIndex
CREATE INDEX "AccessGrant_serviceId_idx" ON "AccessGrant"("serviceId");

-- CreateIndex
CREATE INDEX "AccessGrant_secretId_idx" ON "AccessGrant"("secretId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_consumerId_serviceId_key" ON "AccessGrant"("consumerId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_consumerId_secretId_key" ON "AccessGrant"("consumerId", "secretId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorType_actorId_createdAt_idx" ON "AuditEvent"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_serviceId_createdAt_idx" ON "AuditEvent"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_secretId_createdAt_idx" ON "AuditEvent"("secretId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDoc" ADD CONSTRAINT "ServiceDoc_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedResource" ADD CONSTRAINT "LinkedResource_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "Secret"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "Consumer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

