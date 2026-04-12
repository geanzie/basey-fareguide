export type TerminalPermitStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED";

export type TerminalComplianceStatus = "COMPLIANT" | "NON_COMPLIANT" | "REVIEW_REQUIRED";

export type TerminalScanDisposition = "CLEAR" | "FLAGGED" | "BLOCKED" | "NOT_FOUND";

export type TerminalOperatorIdStatus = "UNAVAILABLE" | "RESOLVED";

export type TerminalScanSource = "CAMERA" | "MANUAL";

export type TerminalAuditResultType = "MATCHED" | "NOT_FOUND" | "ERROR" | "UNAUTHORIZED";

export interface TerminalScanHistoryItemDto {
  id: string;
  scannedAt: string;
  submittedToken: string;
  resultType: TerminalAuditResultType;
  scanSource: TerminalScanSource;
  disposition: TerminalScanDisposition | null;
  matchedPermitId: string | null;
  permitPlateNumber: string | null;
  vehiclePlateNumber: string | null;
}

export interface TerminalScanHistoryResponseDto {
  items: TerminalScanHistoryItemDto[];
}

export interface TerminalUnlockStatusDto {
  unlocked: boolean;
  expiresAt: string | null;
  lastActivityAt: string | null;
}

export interface TerminalUnlockResponseDto extends TerminalUnlockStatusDto {
  message?: string;
}

export interface TerminalComplianceChecklistItemDto {
  key: string;
  label: string;
  status: "PASS" | "FAIL" | "REVIEW";
  detail: string;
}

export interface TerminalViolationSummaryItemDto {
  id: string;
  incidentType: string;
  incidentTypeLabel: string;
  status: string;
  ticketNumber: string | null;
  paymentStatus: string | null;
  penaltyAmount: number | null;
  incidentDate: string;
}

export interface TerminalViolationSummaryDto {
  totalViolations: number;
  openIncidents: number;
  unpaidTickets: number;
  outstandingPenalties: number;
  recentViolations: TerminalViolationSummaryItemDto[];
}

export interface TerminalPermitSummaryDto {
  id: string;
  permitPlateNumber: string;
  qrToken: string;
  qrIssuedAt: string | null;
  qrIssuedBy: string | null;
  driverFullName: string;
  issuedDate: string;
  expiryDate: string;
}

export interface TerminalVehicleSummaryDto {
  id: string;
  plateNumber: string;
  vehicleType: string;
  make: string;
  model: string;
  color: string;
  ownerName: string;
  driverName: string | null;
  driverLicense: string | null;
  registrationExpiry: string;
  insuranceExpiry: string | null;
  isActive: boolean;
}

export interface TerminalOperatorSnapshotDto {
  operatorId: string | null;
  operatorIdStatus: TerminalOperatorIdStatus;
  driverFullName: string | null;
  driverName: string | null;
  ownerName: string | null;
  driverLicense: string | null;
}

export interface TerminalIncidentHandoffSnapshotDto {
  permitId: string;
  vehicleId: string | null;
  operatorId: string | null;
  scannedTokenFingerprint: string;
  permitStatusAtScan: TerminalPermitStatus;
  complianceStatus: TerminalComplianceStatus;
  scanDispositionAtScan: TerminalScanDisposition;
  complianceFlags: string[];
  complianceChecklistAtScan: TerminalComplianceChecklistItemDto[];
  violationSummary: Pick<
    TerminalViolationSummaryDto,
    "totalViolations" | "openIncidents" | "unpaidTickets" | "outstandingPenalties"
  >;
  operator: TerminalOperatorSnapshotDto;
  vehicle: TerminalVehicleSummaryDto | null;
}

export interface TerminalLookupResultDto {
  scannedToken: string;
  matchFound: boolean;
  permitStatus: TerminalPermitStatus | null;
  complianceStatus: TerminalComplianceStatus | null;
  scanDisposition: TerminalScanDisposition;
  permit: TerminalPermitSummaryDto | null;
  vehicle: TerminalVehicleSummaryDto | null;
  operator: TerminalOperatorSnapshotDto | null;
  complianceChecklist: TerminalComplianceChecklistItemDto[];
  violationSummary: TerminalViolationSummaryDto | null;
  incidentHandoff: TerminalIncidentHandoffSnapshotDto | null;
  message: string;
}