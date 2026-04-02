export const DISCOUNT_RATE = 0.2;

export interface DiscountCardPolicyInput {
  id: string;
  userId: string;
  discountType: string;
  verificationStatus: string;
  isActive: boolean;
  validFrom: Date | string;
  validUntil: Date | string;
  isAdminOverride?: boolean | null;
  overrideReason?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
}

export interface DiscountCardPolicyResult {
  isOwner: boolean;
  isActive: boolean;
  isApproved: boolean;
  isExpired: boolean;
  isNotYetValid: boolean;
  isValid: boolean;
  reasons: string[];
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function evaluateDiscountCardPolicy(
  card: DiscountCardPolicyInput,
  options: { userId?: string; now?: Date } = {},
): DiscountCardPolicyResult {
  const now = options.now ?? new Date();
  const validFrom = toDate(card.validFrom);
  const validUntil = toDate(card.validUntil);
  const isOwner = options.userId ? card.userId === options.userId : true;
  const isApproved = card.verificationStatus === "APPROVED";
  const isExpired = now > validUntil;
  const isNotYetValid = now < validFrom;
  const reasons: string[] = [];

  if (!isOwner) reasons.push("Card does not belong to the authenticated user.");
  if (!card.isActive) reasons.push("Card is inactive.");
  if (!isApproved) reasons.push(`Card is not approved (status: ${card.verificationStatus}).`);
  if (isExpired) reasons.push("Card has expired.");
  if (isNotYetValid) reasons.push("Card is not yet valid.");

  return {
    isOwner,
    isActive: card.isActive,
    isApproved,
    isExpired,
    isNotYetValid,
    isValid: reasons.length === 0,
    reasons,
  };
}

export function buildDiscountCardResponse(
  card: DiscountCardPolicyInput,
  evaluation: DiscountCardPolicyResult,
) {
  return {
    id: card.id,
    discountType: card.discountType,
    discountRate: DISCOUNT_RATE,
    discountPercentage: DISCOUNT_RATE * 100,
    verificationStatus: card.verificationStatus,
    isActive: card.isActive,
    validFrom: card.validFrom,
    validUntil: card.validUntil,
    isAdminOverride: card.isAdminOverride ?? false,
    overrideReason: card.overrideReason ?? null,
    user: card.user,
    validationChecks: {
      isOwner: evaluation.isOwner,
      isActive: evaluation.isActive,
      isApproved: evaluation.isApproved,
      isExpired: evaluation.isExpired,
      isNotYetValid: evaluation.isNotYetValid,
      isValid: evaluation.isValid,
      reasons: evaluation.reasons,
    },
  };
}

export function validateDiscountValidityWindow(validFrom: Date, validUntil: Date) {
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }

  if (validUntil <= validFrom) {
    return { valid: false, error: "Valid until date must be after valid from date" };
  }

  return { valid: true as const };
}
