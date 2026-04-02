export interface DashboardStatsDto {
  totalUsers: number;
  totalIncidents: number;
  pendingIncidents: number;
  resolvedIncidents: number;
  totalVehicles: number;
  totalPermits: number;
}

export interface DashboardStatsResponseDto {
  stats: DashboardStatsDto;
}
