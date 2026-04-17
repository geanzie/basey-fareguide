import type {
  DashboardActivityItemDto,
  IncidentListItemDto,
  IncidentPersonDto,
  IncidentTripSummaryDto,
  TicketPaymentStatus,
} from "@/lib/contracts";
import { buildTripRouteLabel, hasVehicleContext } from "@/lib/incidents/reportTripSelection";

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  FARE_OVERCHARGE: "Fare Overcharge",
  FARE_UNDERCHARGE: "Fare Undercharge",
  RECKLESS_DRIVING: "Reckless Driving",
  VEHICLE_VIOLATION: "Vehicle Violation",
  ROUTE_VIOLATION: "Route Violation",
  OTHER: "Other Violation",
  OVERCHARGING: "Overcharging",
  NO_PERMIT: "No Permit",
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  INVESTIGATING: "Investigating",
  TICKET_ISSUED: "Ticket Issued",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
};

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function toNullableString(value: string | null | undefined): string | null {
  return value ?? null;
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toNullableTicketPaymentStatus(
  value: string | null | undefined,
): TicketPaymentStatus | null {
  if (value === "NOT_APPLICABLE" || value === "UNPAID" || value === "PAID") {
    return value;
  }

  return null;
}

export function formatIncidentTypeLabel(type: string): string {
  return INCIDENT_TYPE_LABELS[type] ?? type;
}

export function formatIncidentStatusLabel(status: string): string {
  return INCIDENT_STATUS_LABELS[status] ?? status;
}

export function serializeIncidentPerson(person?: {
  firstName: string;
  lastName: string;
  userType?: string | null;
} | null): IncidentPersonDto | null {
  if (!person) {
    return null;
  }

  return {
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: `${person.firstName} ${person.lastName}`.trim(),
    userType: (person.userType as IncidentPersonDto["userType"]) ?? null,
  };
}

function serializeIncidentTrip(record: {
  fareCalculationId?: string | null;
  tripOrigin?: string | null;
  tripDestination?: string | null;
  tripFare?: number | string | null;
  tripDiscountType?: string | null;
  tripCalculatedAt?: Date | string | null;
  tripCalculationType?: string | null;
  tripPermitPlateNumber?: string | null;
  tripPlateNumber?: string | null;
  tripVehicleType?: string | null;
}): IncidentTripSummaryDto | null {
  if (!record.fareCalculationId || !record.tripOrigin || !record.tripDestination || !record.tripCalculatedAt) {
    return null;
  }

  return {
    fareCalculationId: record.fareCalculationId,
    origin: record.tripOrigin,
    destination: record.tripDestination,
    fare: toNullableNumber(record.tripFare),
    discountType: toNullableString(record.tripDiscountType),
    calculatedAt: toIsoString(record.tripCalculatedAt),
    calculationType: toNullableString(record.tripCalculationType),
    permitPlateNumber: toNullableString(record.tripPermitPlateNumber),
    plateNumber: toNullableString(record.tripPlateNumber),
    vehicleType: toNullableString(record.tripVehicleType),
    hasVehicleContext: hasVehicleContext(record.tripPermitPlateNumber, record.tripPlateNumber),
    routeLabel: buildTripRouteLabel(record.tripOrigin, record.tripDestination),
  };
}

export function serializeIncident(record: {
  id: string;
  incidentType: string;
  description: string;
  location: string;
  fareCalculationId?: string | null;
  tripOrigin?: string | null;
  tripDestination?: string | null;
  tripFare?: number | string | null;
  tripDiscountType?: string | null;
  tripCalculatedAt?: Date | string | null;
  tripCalculationType?: string | null;
  tripPermitPlateNumber?: string | null;
  tripPlateNumber?: string | null;
  tripVehicleType?: string | null;
  plateNumber?: string | null;
  driverLicense?: string | null;
  vehicleType?: string | null;
  incidentDate: Date | string;
  status: string;
  ticketNumber?: string | null;
  paymentStatus?: string | null;
  paidAt?: Date | string | null;
  officialReceiptNumber?: string | null;
  penaltyAmount?: number | string | null;
  remarks?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  handledById?: string | null;
  reportedBy?: {
    firstName: string;
    lastName: string;
    userType?: string | null;
  } | null;
  handledBy?: {
    firstName: string;
    lastName: string;
    userType?: string | null;
  } | null;
  evidenceCount?: number;
  evidenceVerifiedAt?: Date | string | null;
  evidenceVerifiedBy?: { firstName: string; lastName: string; userType?: string | null } | null;
  ticketIssuedAt?: Date | string | null;
  ticketIssuedBy?: { firstName: string; lastName: string; userType?: string | null } | null;
  dismissedAt?: Date | string | null;
  dismissedBy?: { firstName: string; lastName: string; userType?: string | null } | null;
  dismissRemarks?: string | null;
  paymentRecordedAt?: Date | string | null;
  paymentRecordedBy?: { firstName: string; lastName: string; userType?: string | null } | null;
}): IncidentListItemDto {
  return {
    id: record.id,
    type: record.incidentType,
    typeLabel: formatIncidentTypeLabel(record.incidentType),
    description: record.description,
    location: record.location,
    plateNumber: toNullableString(record.plateNumber),
    driverLicense: toNullableString(record.driverLicense),
    vehicleType: toNullableString(record.vehicleType),
    date: toIsoString(record.incidentDate),
    status: record.status,
    statusLabel: formatIncidentStatusLabel(record.status),
    ticketNumber: toNullableString(record.ticketNumber),
    paymentStatus: toNullableTicketPaymentStatus(record.paymentStatus),
    paidAt: record.paidAt ? toIsoString(record.paidAt) : null,
    officialReceiptNumber: toNullableString(record.officialReceiptNumber),
    penaltyAmount: toNullableNumber(record.penaltyAmount),
    remarks: toNullableString(record.remarks),
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    handledById: toNullableString(record.handledById),
    reportedBy: serializeIncidentPerson(record.reportedBy),
    handledBy: serializeIncidentPerson(record.handledBy),
    trip: serializeIncidentTrip(record),
    evidenceCount: record.evidenceCount,
    evidenceVerifiedAt: record.evidenceVerifiedAt ? toIsoString(record.evidenceVerifiedAt) : null,
    evidenceVerifiedBy: serializeIncidentPerson(record.evidenceVerifiedBy),
    ticketIssuedAt: record.ticketIssuedAt ? toIsoString(record.ticketIssuedAt) : null,
    ticketIssuedBy: serializeIncidentPerson(record.ticketIssuedBy),
    dismissedAt: record.dismissedAt ? toIsoString(record.dismissedAt) : null,
    dismissedBy: serializeIncidentPerson(record.dismissedBy),
    dismissRemarks: toNullableString(record.dismissRemarks),
    paymentRecordedAt: record.paymentRecordedAt ? toIsoString(record.paymentRecordedAt) : null,
    paymentRecordedBy: serializeIncidentPerson(record.paymentRecordedBy),
  };
}

export function serializeDashboardActivityItem(record: {
  id: string;
  incidentType: string;
  description: string;
  location: string;
  status: string;
  createdAt: Date | string;
  ticketNumber?: string | null;
  reportedBy?: {
    firstName: string;
    lastName: string;
  } | null;
  handledBy?: {
    firstName: string;
    lastName: string;
  } | null;
}): DashboardActivityItemDto {
  const incident = serializeIncident({
    id: record.id,
    incidentType: record.incidentType,
    description: record.description,
    location: record.location,
    incidentDate: record.createdAt,
    status: record.status,
    ticketNumber: record.ticketNumber ?? null,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    reportedBy: record.reportedBy ?? null,
    handledBy: record.handledBy ?? null,
  });

  return {
    id: incident.id,
    type: incident.type,
    typeLabel: incident.typeLabel,
    description: incident.description,
    location: incident.location,
    status: incident.status,
    statusLabel: incident.statusLabel,
    reportedBy: incident.reportedBy?.fullName ?? null,
    handledBy: incident.handledBy?.fullName ?? null,
    createdAt: incident.createdAt,
    ticketNumber: incident.ticketNumber,
  };
}
