import {
  ConsumerKind,
  ResourceType,
  RiskLevel,
  ServiceStatus,
  VisibilityMode,
} from "@prisma/client";

export const riskLevelOptions = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];

export const serviceStatusOptions = [
  ServiceStatus.ACTIVE,
  ServiceStatus.DRAFT,
  ServiceStatus.PAUSED,
  ServiceStatus.DEPRECATED,
];

export const visibilityModeOptions = [
  VisibilityMode.OWNER_ONLY,
  VisibilityMode.TRUSTED_AGENTS,
  VisibilityMode.SELECTED_CONSUMERS,
];

export const resourceTypeOptions = [
  ResourceType.URL,
  ResourceType.LOCAL_PATH,
  ResourceType.REPO_PATH,
  ResourceType.SKILL,
  ResourceType.INTERNAL_NOTE,
  ResourceType.AUTOMATION,
];

export const consumerKindOptions = [
  ConsumerKind.TRUSTED_AGENT,
  ConsumerKind.LOCAL_TOOL,
  ConsumerKind.REVIEW_APP,
  ConsumerKind.SCRIPT,
  ConsumerKind.OTHER,
];
