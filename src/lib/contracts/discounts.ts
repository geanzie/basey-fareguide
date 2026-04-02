export type DiscountType = "SENIOR_CITIZEN" | "PWD" | "STUDENT";

export interface DiscountCardValidationChecksDto {
  isOwner: boolean;
  isActive: boolean;
  isApproved: boolean;
  isExpired: boolean;
  isNotYetValid: boolean;
  isValid: boolean;
  reasons: string[];
}

export interface DiscountCardUserSummaryDto {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface DiscountCardDto {
  id: string;
  discountType: string;
  discountRate: number;
  discountPercentage: number;
  verificationStatus: string;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  isAdminOverride: boolean;
  overrideReason: string | null;
  user?: DiscountCardUserSummaryDto;
  validationChecks: DiscountCardValidationChecksDto;
  fullName?: string | null;
  dateOfBirth?: string | null;
  photoUrl?: string | null;
  idNumber?: string | null;
  idType?: string | null;
  issuingAuthority?: string | null;
  schoolName?: string | null;
  schoolAddress?: string | null;
  gradeLevel?: string | null;
  schoolIdExpiry?: string | null;
  disabilityType?: string | null;
  pwdIdExpiry?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
  rejectionReason?: string | null;
  lastUsedAt?: string | null;
  usageCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface DiscountCardMeResponseDto {
  hasDiscountCard: boolean;
  isValid?: boolean;
  discountCard: DiscountCardDto | null;
  validationChecks?: DiscountCardValidationChecksDto;
}

export interface DiscountCardApplicationResponseDto {
  hasApplication: boolean;
  application: DiscountCardDto | null;
}
