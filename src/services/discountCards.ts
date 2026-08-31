import { api } from './api';
import type { CardStatusResponse, DiscountCard } from '@/types/discount';

export async function fetchMyDiscountCard(): Promise<CardStatusResponse> {
  return api.get<CardStatusResponse>('/api/discount-cards/me');
}

/**
 * The card a fare quote may be discounted with, or null.
 *
 * Validity is the server's call (`isValid`); this only adds the active check so
 * a deactivated card never reaches the trip-request payload, which would 403.
 */
export function usableDiscountCard(status: CardStatusResponse | null): DiscountCard | null {
  if (!status?.hasDiscountCard || !status.isValid) return null;
  const card = status.discountCard;
  return card?.isActive ? card : null;
}
