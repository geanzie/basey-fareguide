export type RoutingPrimaryProviderDto = "ors" | "google_routes";

export type RoutingSettingsSourceDto = "database" | "environment_default";

export interface AdminRoutingSettingsResponseDto {
  primaryProvider: RoutingPrimaryProviderDto;
  fallbackProvider: RoutingPrimaryProviderDto;
  fallbackEnabled: boolean;
  fallbackDescription: string;
  cacheInvalidationNote: string;
  source: RoutingSettingsSourceDto;
  lastUpdatedById: string | null;
  lastUpdatedByName: string | null;
  lastUpdatedAt: string | null;
  warning?: string | null;
}