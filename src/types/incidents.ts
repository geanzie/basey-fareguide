export type IncidentType =
  | 'OVERCHARGING'
  | 'RECKLESS_DRIVING'
  | 'REFUSAL_OF_SERVICE'
  | 'COLORUM'
  | 'OVERLOADING'
  | 'OTHER';

export type IncidentStatus =
  | 'PENDING'
  | 'INVESTIGATING'
  | 'TICKET_ISSUED'
  | 'RESOLVED'
  | 'DISMISSED';

export type TicketPaymentStatus = 'UNPAID' | 'PAID' | 'WAIVED';

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
  createdAt: string;
}

export interface CreateIncidentRequest {
  incidentType: IncidentType;
  description: string;
  location: string;
  plateNumber?: string;
  incidentDate: string;
}

export interface IssueTicketRequest {
  penaltyAmount: number;
}

export interface DismissIncidentRequest {
  dismissRemarks: string;
}
