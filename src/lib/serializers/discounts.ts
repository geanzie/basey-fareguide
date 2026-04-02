import type { DiscountCardDto } from "@/lib/contracts";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeDiscountCard(card: {
  id: string;
  discountType: string;
  discountRate: number;
  discountPercentage: number;
  verificationStatus: string;
  isActive: boolean;
  validFrom: Date | string | null;
  validUntil: Date | string | null;
  isAdminOverride: boolean;
  overrideReason: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
  validationChecks: DiscountCardDto["validationChecks"];
  [key: string]: unknown;
}): DiscountCardDto {
  return {
    ...card,
    validFrom: toIsoString(card.validFrom),
    validUntil: toIsoString(card.validUntil),
    verifiedAt: toIsoString(card.verifiedAt as Date | string | null | undefined),
    lastUsedAt: toIsoString(card.lastUsedAt as Date | string | null | undefined),
    createdAt: toIsoString(card.createdAt as Date | string | null | undefined),
    updatedAt: toIsoString(card.updatedAt as Date | string | null | undefined),
    dateOfBirth: toIsoString(card.dateOfBirth as Date | string | null | undefined),
    schoolIdExpiry: toIsoString(card.schoolIdExpiry as Date | string | null | undefined),
    pwdIdExpiry: toIsoString(card.pwdIdExpiry as Date | string | null | undefined),
  };
}
