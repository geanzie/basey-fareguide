import type { PaginationDto, UserRole } from "./common";

export type IncidentStatus =
  | "PENDING"
  | "INVESTIGATING"
  | "RESOLVED"
  | "DISMISSED";

export type IncidentType =
  | "FARE_OVERCHARGE"
  | "FARE_UNDERCHARGE"
  | "RECKLESS_DRIVING"
  | "VEHICLE_VIOLATION"
  | "ROUTE_VIOLATION"
  | "OTHER"
  | string;

export interface IncidentPersonDto {
  firstName: string;
  lastName: string;
  fullName: string;
  userType?: UserRole | null;
}

export interface IncidentListItemDto {
  id: string;
  type: IncidentType;
  typeLabel: string;
  description: string;
  location: string;
  plateNumber: string | null;
  driverLicense: string | null;
  vehicleType: string | null;
  date: string;
  status: IncidentStatus | string;
  statusLabel: string;
  ticketNumber: string | null;
  penaltyAmount: number | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  reportedBy: IncidentPersonDto | null;
  handledBy: IncidentPersonDto | null;
  evidenceCount?: number;
}

export interface IncidentsResponseDto {
  incidents: IncidentListItemDto[];
  pagination?: PaginationDto;
  message?: string;
  filters?: {
    days: number;
    violationType: string;
  };
}

export interface DashboardActivityItemDto {
  id: string;
  type: IncidentType;
  typeLabel: string;
  description: string;
  location: string;
  status: IncidentStatus | string;
  statusLabel: string;
  reportedBy: string | null;
  handledBy: string | null;
  createdAt: string;
  ticketNumber: string | null;
}

export interface DashboardActivityResponseDto {
  activity: DashboardActivityItemDto[];
}
