export type DriverSessionStatusDto = "OPEN" | "IN_PROGRESS" | "CLOSED";

export type DriverSessionRiderStatusDto =
  | "PENDING"
  | "ACCEPTED"
  | "BOARDED"
  | "COMPLETED"
  | "REJECTED_NOT_HERE"
  | "REJECTED_FULL"
  | "REJECTED_WRONG_TRIP"
  | "CANCELLED"
  | "EXPIRED";

export type DriverSessionActionDto =
  | "ACCEPT"
  | "BOARDED"
  | "DROPPED_OFF"
  | "NOT_HERE"
  | "FULL"
  | "WRONG_TRIP"
  | "CANCELLED";

export type DriverSessionActionKindDto = "positive" | "negative";

export type DriverSessionSectionKeyDto = "pending" | "boarded" | "completed" | "archived";

export interface DriverSessionActionButtonDto {
  action: DriverSessionActionDto;
  label: string;
  kind: DriverSessionActionKindDto;
}

export interface DriverSessionHistoryRiderDto {
  id: string;
  fareCalculationId: string | null;
  origin: string;
  destination: string;
  fareSnapshot: number;
  discountType: string | null;
  status: DriverSessionRiderStatusDto;
  statusLabel: string;
  joinedAt: string;
  acceptedAt: string | null;
  boardedAt: string | null;
  completedAt: string | null;
  finalisedAt: string | null;
}

export interface DriverSessionHistoryItemDto {
  id: string;
  status: Extract<DriverSessionStatusDto, "CLOSED">;
  statusLabel: string;
  openedAt: string;
  closedAt: string;
  riderCount: number;
  completedCount: number;
  archivedCount: number;
  riders: DriverSessionHistoryRiderDto[];
}

export interface DriverSessionHistoryResponseDto {
  items: DriverSessionHistoryItemDto[];
  limit: number;
  page: number;
  total: number;
  totalPages: number;
}

export interface DriverSessionRiderCardDto {
  id: string;
  fareCalculationId: string | null;
  origin: string;
  destination: string;
  fareSnapshot: number;
  discountType: string | null;
  status: DriverSessionRiderStatusDto;
  statusLabel: string;
  joinedAt: string;
  availableActions: DriverSessionActionButtonDto[];
}

export interface DriverSessionSectionDto {
  key: DriverSessionSectionKeyDto;
  label: string;
  riders: DriverSessionRiderCardDto[];
}

export interface DriverSessionVehicleDto {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  color: string;
  assignedAt: string | null;
}

export interface DriverSessionSummaryDto {
  id: string | null;
  status: DriverSessionStatusDto | null;
  statusLabel: string;
  activeRiderCount: number;
  pendingCount: number;
  boardedCount: number;
  completedCount: number;
  archivedCount: number;
  openedAt: string | null;
  closedAt: string | null;
  canStartSession: boolean;
  canCloseSession: boolean;
}

export interface DriverSessionDriverDto {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface DriverSessionActiveResponseDto {
  driver: DriverSessionDriverDto;
  vehicle: DriverSessionVehicleDto;
  session: DriverSessionSummaryDto;
  sections: DriverSessionSectionDto[];
}

export interface DriverSessionActionRequestDto {
  action: DriverSessionActionDto;
}

export interface DriverSessionActionResponseDto {
  success: boolean;
  session: DriverSessionSummaryDto;
  rider: DriverSessionRiderCardDto;
  message: string;
}