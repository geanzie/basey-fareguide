export const PENALTY_RULE_VERSION = '2026-04-municipal-v1'

export type OffenseTier = 'FIRST' | 'SECOND' | 'THIRD_PLUS'

export interface OffensePenaltyDecision {
  offenseNumber: number
  offenseTier: OffenseTier
  penaltyAmount: number
  priorTicketCount: number
  ruleVersion: string
}

export const PUBLIC_PENALTY_SCHEDULE: Array<{
  offenseNumber: number
  offenseTier: OffenseTier
  label: string
  penaltyAmount: number
}> = [
  {
    offenseNumber: 1,
    offenseTier: 'FIRST',
    label: '1st offense',
    penaltyAmount: 500,
  },
  {
    offenseNumber: 2,
    offenseTier: 'SECOND',
    label: '2nd offense',
    penaltyAmount: 1000,
  },
  {
    offenseNumber: 3,
    offenseTier: 'THIRD_PLUS',
    label: '3rd offense and above',
    penaltyAmount: 1500,
  },
]

export function normalizePlateNumber(plateNumber: string | null | undefined): string | null {
  if (!plateNumber) {
    return null
  }

  const normalized = plateNumber.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function getOffenseTier(offenseNumber: number): OffenseTier {
  if (offenseNumber <= 1) {
    return 'FIRST'
  }

  if (offenseNumber === 2) {
    return 'SECOND'
  }

  return 'THIRD_PLUS'
}

export function getPenaltyAmountForOffense(offenseNumber: number): number {
  switch (getOffenseTier(offenseNumber)) {
    case 'FIRST':
      return 500
    case 'SECOND':
      return 1000
    case 'THIRD_PLUS':
      return 1500
  }
}

export function getOffenseTierLabel(offenseTier: OffenseTier): string {
  switch (offenseTier) {
    case 'FIRST':
      return '1st offense'
    case 'SECOND':
      return '2nd offense'
    case 'THIRD_PLUS':
      return '3rd offense and above'
  }
}

export function buildOffensePenaltyDecision(priorTicketCount: number): OffensePenaltyDecision {
  const offenseNumber = priorTicketCount + 1

  return {
    offenseNumber,
    offenseTier: getOffenseTier(offenseNumber),
    penaltyAmount: getPenaltyAmountForOffense(offenseNumber),
    priorTicketCount,
    ruleVersion: PENALTY_RULE_VERSION,
  }
}