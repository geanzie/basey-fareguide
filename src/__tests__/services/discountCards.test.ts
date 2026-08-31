import { usableDiscountCard } from '@/services/discountCards';
import type { CardStatusResponse, DiscountCard } from '@/types/discount';

const CARD: DiscountCard = {
  id: 'card-1',
  discountType: 'STUDENT',
  verificationStatus: 'APPROVED',
  isActive: true,
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2027-01-01T00:00:00.000Z',
};

const status = (over: Partial<CardStatusResponse>): CardStatusResponse => ({
  hasDiscountCard: true,
  isValid: true,
  discountCard: CARD,
  ...over,
});

describe('usableDiscountCard', () => {
  it('returns the card when the server says it is valid and it is active', () => {
    expect(usableDiscountCard(status({}))).toEqual(CARD);
  });

  it('returns null when there is no card status at all', () => {
    expect(usableDiscountCard(null)).toBeNull();
  });

  it('returns null when the passenger has no card', () => {
    expect(usableDiscountCard(status({ hasDiscountCard: false, discountCard: null }))).toBeNull();
  });

  it('returns null when the server withholds validity', () => {
    expect(usableDiscountCard(status({ isValid: false }))).toBeNull();
    expect(usableDiscountCard(status({ isValid: undefined }))).toBeNull();
  });

  it('returns null for a deactivated card, which the trip request would reject', () => {
    expect(usableDiscountCard(status({ discountCard: { ...CARD, isActive: false } }))).toBeNull();
  });
});
