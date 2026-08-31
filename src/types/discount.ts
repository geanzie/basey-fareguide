/**
 * Discount card shapes, mirroring GET /api/discount-cards/me.
 *
 * The card is the only way a passenger qualifies for the 20% statutory
 * discount — there is no self-declared passenger type. Both the discount
 * screen and the fare calculator read these.
 */

/** Domain format used by the database and the trip-request payload. */
export type DiscountCardType = 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT';

export interface DiscountCard {
  id: string;
  discountType: DiscountCardType;
  verificationStatus: string;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

export interface CardStatusResponse {
  hasDiscountCard: boolean;
  /** Server-computed validity — approved, active and inside its date window. */
  isValid?: boolean;
  discountCard: DiscountCard | null;
}
