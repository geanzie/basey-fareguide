import type { PaginationDto, UserRole } from "./common";

export type IncidentStatus =
  | "PENDING"
  | "INVESTIGATING"
  | "RESOLVED"
  | "DISMISSED";

export type EnforcerIncidentsViewMode = "dashboard" | "queue";

export type EnforcerIncidentScope = "all" | "unresolved";

export type TicketPaymentStatus = "NOT_APPLICABLE" | "UNPAID" | "PAID";

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

export interface IncidentTripSummaryDto {
  fareCalculationId: string | null;
  origin: string;
  destination: string;
  fare: number | null;
  discountType: string | null;
  calculatedAt: string;
  calculationType: string | null;
  permitPlateNumber: string | null;
  plateNumber: string | null;
  vehicleType: string | null;
  hasVehicleContext: boolean;
  routeLabel: string;
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
  paymentStatus: TicketPaymentStatus | null;
  paidAt: string | null;
  officialReceiptNumber: string | null;
  penaltyAmount: number | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  reportedBy: IncidentPersonDto | null;
  handledBy: IncidentPersonDto | null;
  trip: IncidentTripSummaryDto | null;
  evidenceCount?: number;
}

export interface IncidentsResponseDto {
  incidents: IncidentListItemDto[];
  pagination?: PaginationDto;
  message?: string;
  filters?: {
    days?: number;
    violationType?: string;
    scope?: EnforcerIncidentScope;
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
