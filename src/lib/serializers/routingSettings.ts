import type {
  AdminRoutingSettingsResponseDto,
  RoutingPrimaryProviderDto,
  RoutingSettingsSourceDto,
} from "@/lib/contracts";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatActorName(actor: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null | undefined): string | null {
  if (!actor) {
    return null;
  }

  const fullName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return actor.username ? `${fullName} (@${actor.username})` : fullName;
  }

  return actor.username ? `@${actor.username}` : null;
}

function getFallbackProvider(
  primaryProvider: RoutingPrimaryProviderDto,
): RoutingPrimaryProviderDto {
  return primaryProvider === "ors" ? "google_routes" : "ors";
}

export function serializeAdminRoutingSettings(input: {
  primaryProvider: RoutingPrimaryProviderDto;
  source: RoutingSettingsSourceDto;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
  updatedByUser?: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } | null;
  warning?: string | null;
}): AdminRoutingSettingsResponseDto {
  return {
    primaryProvider: input.primaryProvider,
    fallbackProvider: getFallbackProvider(input.primaryProvider),
    fallbackEnabled: true,
    fallbackDescription: "Automatic fallback to the other provider is enabled.",
    cacheInvalidationNote:
      "Changes apply to new route calculations. Cached routes from the previous provider are invalidated.",
    source: input.source,
    lastUpdatedById: input.updatedBy ?? null,
    lastUpdatedByName: formatActorName(input.updatedByUser),
    lastUpdatedAt: toIsoString(input.updatedAt),
    warning: input.warning ?? null,
  };
}