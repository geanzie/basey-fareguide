export type IncidentType =
  | 'FARE_OVERCHARGE'
  | 'FARE_UNDERCHARGE'
  | 'RECKLESS_DRIVING'
  | 'VEHICLE_VIOLATION'
  | 'ROUTE_VIOLATION'
  | 'OTHER';

export type IncidentStatus =
  | 'PENDING'
  | 'INVESTIGATING'
  | 'TICKET_ISSUED'
  | 'RESOLVED'
  | 'DISMISSED';

export type TicketPaymentStatus = 'UNPAID' | 'PAID' | 'WAIVED';

export type EvidenceFileStatus = 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REQUIRES_ADDITIONAL';

export interface EvidenceFile {
  id: string;
  fileName: string;
  fileType: string;
  status: EvidenceFileStatus;
  createdAt: string;
}

export interface TicketPenaltyPreview {
  offenseNumber: number;
  offenseTier: 'FIRST' | 'SECOND' | 'THIRD_PLUS';
  offenseTierLabel: string;
  currentPenaltyAmount: number;
  carriedForwardPenaltyAmount: number;
  priorTicketCount: number;
  priorUnpaidTicketCount: number;
  ruleVersion: string;
}

export interface EnforcerStats {
  total: number;
  pending: number;
  ticketIssued: number;
  resolved: number;
  dismissed: number;
}

export interface Incident {
  id: string;
  incidentType: IncidentType;
  status: IncidentStatus;
  description: string;
  location: string;
  plateNumber?: string;
  incidentDate: string;
  ticketNumber?: string;
  penaltyAmount?: number;
  paymentStatus?: TicketPaymentStatus;
  evidenceVerifiedAt?: string | null;
  evidenceCount?: number;
  createdAt: string;
}

export interface CreateIncidentRequest {
  incidentType: IncidentType;
  description: string;
  location: string;
  plateNumber?: string;
  vehicleId?: string;
  fareCalculationId?: string;
  incidentDate: string;
}

export interface IssueTicketRequest {
  ticketNumber: string;
  remarks?: string;
}

export interface DismissIncidentRequest {
  remarks: string;
}
