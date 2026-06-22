export type TerminalScanDisposition = 'CLEAR' | 'FLAGGED' | 'BLOCKED' | 'NOT_FOUND';
export type TerminalPermitStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
export type TerminalComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'REVIEW_REQUIRED';

export interface TerminalComplianceChecklistItem {
  label: string;
  passed: boolean;
  detail: string | null;
}

export interface TerminalViolationSummaryItem {
  incidentType: string;
  status: string;
  ticketNumber: string | null;
  paymentStatus: string | null;
  penaltyAmount: number | null;
  incidentDate: string;
}

export interface TerminalViolationSummary {
  totalViolations: number;
  openIncidents: number;
  unpaidTickets: number;
  outstandingPenalties: number;
  recentViolations: TerminalViolationSummaryItem[];
}

export interface TerminalPermitSummary {
  id: string;
  plateNumber: string;
  qrToken: string;
  issueDate: string;
  expiryDate: string;
}

export interface TerminalVehicleSummary {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  color: string | null;
  ownerName: string | null;
  driverName: string | null;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  isActive: boolean;
}

export interface TerminalLookupResult {
  scannedToken: string;
  matchFound: boolean;
  permitStatus: TerminalPermitStatus | null;
  complianceStatus: TerminalComplianceStatus;
  scanDisposition: TerminalScanDisposition;
  permit: TerminalPermitSummary | null;
  vehicle: TerminalVehicleSummary | null;
  complianceChecklist: TerminalComplianceChecklistItem[];
  violationSummary: TerminalViolationSummary | null;
  message: string;
}
