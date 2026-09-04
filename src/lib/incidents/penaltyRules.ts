import type { IncidentType as PrismaIncidentType } from '@prisma/client'

/**
 * Penalties under Municipal Ordinance No. 105, Series of 2023.
 *
 * Every amount here cites the provision that authorises it. That is not
 * decoration: Section 33 is the ordinance's ONLY penal provision, it fines four
 * specific franchise offences, and it fines nothing else. There is no catch-all
 * "any violation of this ordinance" fine. A fare overcharge is a breach of
 * Sec. 24, and the remedy the ordinance gives it is not money -- Sec. 29(a)
 * makes it a ground for cancelling the franchise and Sec. 30 is the process,
 * read in session by the Sangguniang Bayan.
 *
 * The previous version of this file applied the Sec. 33(a) ladder to every
 * violation type, so the system issued fines nothing authorised. Anything added
 * here must name its section, or be NO_FINE.
 *
 * Source: frontend/public/ordinances/municipal-ordinance-no-105.pdf, pp. 5, 11-13.
 */
export const PENALTY_RULE_VERSION = '2023-ord105-sec33-v1'

/**
 * Rows written before the schedule cited anything. Kept so a ticket issued
 * under the old rule stays readable and auditable rather than looking like it
 * was priced by the current one.
 */
export const LEGACY_PENALTY_RULE_VERSION = '2026-04-municipal-v1'

export type OffenseTier = 'FIRST' | 'SECOND' | 'THIRD_PLUS'

/** Ordinance sections that carry a monetary penalty. */
export type PenaltySection = '33(a)' | '33(b)' | '33(c)' | '28' | '11'

export type PenaltyBasis =
  | {
      kind: 'TIERED'
      section: '33(a)'
      tiers: readonly [number, number, number]
      /** Sec. 33(a) third offence is a fine "or imprisonment ... or both at the
       *  discretion of the Court". The LGU imposes the fine; only a court may
       *  do the rest, so this text must reach the enforcer. */
      courtDiscretionNote: string
    }
  | {
      kind: 'FLAT_MINIMUM'
      section: '33(b)' | '33(c)'
      /** The ordinance says "not less than". This is a floor, not a price. */
      minimumAmount: number
    }
  | {
      kind: 'FLAT'
      section: '28'
      amount: number
      courtDiscretionNote: string
    }
  | {
      kind: 'NO_FINE'
      /** Sec. 29(a) is the ground; Sec. 30 the Sangguniang Bayan process. */
      groundSection: '29(a)'
      processSection: '30'
    }

const COURT_DISCRETION_33A =
  'Third offence: P1,500.00 or imprisonment of thirty (30) days or both, at the discretion of the Court. The municipality imposes the fine only.'

const COURT_DISCRETION_28 =
  'P2,000.00 or imprisonment not exceeding one month or both, upon the discretion of the court. The municipality imposes the fine only.'

const NO_FINE: PenaltyBasis = {
  kind: 'NO_FINE',
  groundSection: '29(a)',
  processSection: '30',
}

/**
 * What authorises a penalty for each violation, or that nothing does.
 *
 * The four franchise offences are the whole of the ordinance's ticketable
 * penal provision. Everything else -- fares, driving, vehicle condition, route
 * -- is NO_FINE, and is referred for franchise action instead.
 */
export const VIOLATION_PENALTY_BASIS = {
  NO_FRANCHISE_AND_MTOP: {
    kind: 'TIERED',
    section: '33(a)',
    tiers: [500, 1000, 1500],
    courtDiscretionNote: COURT_DISCRETION_33A,
  },
  CANCELLED_FRANCHISE_OPERATION: {
    kind: 'FLAT_MINIMUM',
    section: '33(b)',
    minimumAmount: 2500,
  },
  FRANCHISE_FRAUD: {
    kind: 'FLAT_MINIMUM',
    section: '33(c)',
    minimumAmount: 2500,
  },
  FRANCHISE_TRANSFER_VIOLATION: {
    kind: 'FLAT',
    section: '28',
    amount: 2000,
    courtDiscretionNote: COURT_DISCRETION_28,
  },

  FARE_OVERCHARGE: NO_FINE,
  FARE_UNDERCHARGE: NO_FINE,
  EMPTY_SEAT_CHARGE: NO_FINE,
  UNAUTHORIZED_CARGO_CHARGE: NO_FINE,
  REFUSED_POSTED_FARE: NO_FINE,
  OTHER_FARE_DISPUTE: NO_FINE,
  REFUSED_VALID_DISCOUNT: NO_FINE,
  RECKLESS_DRIVING: NO_FINE,
  VEHICLE_VIOLATION: NO_FINE,
  ROUTE_VIOLATION: NO_FINE,
  OTHER: NO_FINE,
} as const satisfies Record<PrismaIncidentType, PenaltyBasis>

/**
 * Sec. 11: failing to renew a franchise on time. Charged at renewal by the
 * treasury, not by an enforcer's ticket, so it has no IncidentType and nothing
 * reads this yet. Recorded here so the ordinance's schedule is complete in one
 * place, and so wiring it into the permit renewal flow later starts from the
 * cited text rather than from memory.
 */
export const LATE_RENEWAL_FEES: ReadonlyArray<{
  section: '11'
  label: string
  amount: number
}> = [
  { section: '11', label: 'Up to 15 days after expiration', amount: 200 },
  { section: '11', label: '16 days to 1 month after expiration', amount: 300 },
]

/**
 * What the public About page shows. Shape and name are load-bearing: that page
 * renders these three cards, and its wording is the municipality's to change.
 *
 * Note this is the Sec. 33(a) ladder specifically -- the offence of operating
 * without both a franchise and an MTOP.
 */
export const PUBLIC_PENALTY_SCHEDULE: Array<{
  offenseNumber: number
  offenseTier: OffenseTier
  label: string
  penaltyAmount: number
}> = [
  { offenseNumber: 1, offenseTier: 'FIRST', label: '1st offense', penaltyAmount: 500 },
  { offenseNumber: 2, offenseTier: 'SECOND', label: '2nd offense', penaltyAmount: 1000 },
  { offenseNumber: 3, offenseTier: 'THIRD_PLUS', label: '3rd offense and above', penaltyAmount: 1500 },
]

/**
 * Violations a member of the public may file. The franchise offences are
 * excluded on purpose: they are enforcer observations carrying the ordinance's
 * only fines, and /api/incidents/report is open to any authenticated user.
 */
export const PUBLIC_REPORTABLE_INCIDENT_TYPES: readonly PrismaIncidentType[] = [
  'FARE_OVERCHARGE',
  'FARE_UNDERCHARGE',
  'RECKLESS_DRIVING',
  'VEHICLE_VIOLATION',
  'ROUTE_VIOLATION',
  'EMPTY_SEAT_CHARGE',
  'UNAUTHORIZED_CARGO_CHARGE',
  'REFUSED_POSTED_FARE',
  'OTHER_FARE_DISPUTE',
  'REFUSED_VALID_DISCOUNT',
  'OTHER',
]

export const ENFORCER_ONLY_INCIDENT_TYPES: readonly PrismaIncidentType[] = [
  'NO_FRANCHISE_AND_MTOP',
  'CANCELLED_FRANCHISE_OPERATION',
  'FRANCHISE_FRAUD',
  'FRANCHISE_TRANSFER_VIOLATION',
]

export function isValidIncidentType(value: unknown): value is PrismaIncidentType {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(VIOLATION_PENALTY_BASIS, value)
  )
}

/**
 * Falls back to NO_FINE for anything unrecognised. That is the safe direction:
 * a violation the module cannot identify must not be assigned a fine, and a
 * row holding an enum value this build does not know is exactly the drift that
 * has bitten this table before.
 */
export function getPenaltyBasis(
  incidentType: PrismaIncidentType | string | null | undefined,
): PenaltyBasis {
  if (!isValidIncidentType(incidentType)) {
    return NO_FINE
  }

  return VIOLATION_PENALTY_BASIS[incidentType]
}

/** Whether Ordinance 105 authorises a fine for this violation at all. */
export function isFineable(
  incidentType: PrismaIncidentType | string | null | undefined,
): boolean {
  return getPenaltyBasis(incidentType).kind !== 'NO_FINE'
}

export interface OffensePenaltyDecision {
  incidentType: PrismaIncidentType
  basis: PenaltyBasis
  fineable: boolean
  /** Which section authorises the amount, or null when nothing does. */
  section: PenaltySection | null
  /** Nth ticket for THIS violation on this plate. */
  offenseNumber: number
  /** Only meaningful for the Sec. 33(a) ladder; null for every other basis. */
  offenseTier: OffenseTier | null
  /** This ticket alone. Zero when the ordinance authorises no fine. */
  penaltyAmount: number
  /** How to render the amount, including "not less than" for a floor. */
  amountLabel: string
  /** Unpaid earlier tickets on the plate, across all violation types. */
  outstandingArrears: number
  /** This ticket plus arrears. A plate balance, not a single penalty. */
  totalOwedOnPlate: number
  priorTicketCount: number
  priorUnpaidTicketCount: number
  courtDiscretionNote: string | null
  ruleVersion: string
}

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

function formatPeso(amount: number): string {
  return `PHP ${amount.toLocaleString('en-PH')}`
}

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }

  return amount
}

/**
 * Prices one ticket.
 *
 * `priorSameTypeTicketCount` must count earlier tickets for the SAME violation
 * on the same plate. Sec. 33(a) speaks of a first, second and third *offence*,
 * which means a repeat of that offence -- counting an unrelated ticket toward
 * the ladder inflates the fine on a basis the ordinance does not give.
 *
 * `outstandingArrears` is deliberately plate-wide and separate: it is debt
 * already owed, not part of what this ticket imposes. Nothing in the ordinance
 * compounds an unpaid fine into a later one, so the two must never be added
 * into a single figure presented as one penalty.
 */
export function buildOffensePenaltyDecision(
  incidentType: PrismaIncidentType | string | null | undefined,
  priorSameTypeTicketCount: number,
  outstandingArrears: number = 0,
  priorUnpaidTicketCount: number = 0,
): OffensePenaltyDecision {
  const basis = getPenaltyBasis(incidentType)
  const offenseNumber = Math.max(1, priorSameTypeTicketCount + 1)
  const arrears = normalizeAmount(outstandingArrears)

  let penaltyAmount = 0
  let amountLabel = 'No fine under Ordinance 105'
  let offenseTier: OffenseTier | null = null
  let courtDiscretionNote: string | null = null
  let section: PenaltySection | null = null

  switch (basis.kind) {
    case 'TIERED': {
      offenseTier = getOffenseTier(offenseNumber)
      const index = offenseTier === 'FIRST' ? 0 : offenseTier === 'SECOND' ? 1 : 2
      penaltyAmount = basis.tiers[index]
      amountLabel = formatPeso(penaltyAmount)
      section = basis.section
      // Only the third tier carries the imprisonment alternative.
      courtDiscretionNote = offenseTier === 'THIRD_PLUS' ? basis.courtDiscretionNote : null
      break
    }
    case 'FLAT_MINIMUM': {
      penaltyAmount = basis.minimumAmount
      amountLabel = `not less than ${formatPeso(basis.minimumAmount)}`
      section = basis.section
      break
    }
    case 'FLAT': {
      penaltyAmount = basis.amount
      amountLabel = formatPeso(basis.amount)
      section = basis.section
      courtDiscretionNote = basis.courtDiscretionNote
      break
    }
    case 'NO_FINE': {
      break
    }
  }

  return {
    incidentType: isValidIncidentType(incidentType) ? incidentType : 'OTHER',
    basis,
    fineable: basis.kind !== 'NO_FINE',
    section,
    offenseNumber,
    offenseTier,
    penaltyAmount,
    amountLabel,
    outstandingArrears: arrears,
    totalOwedOnPlate: penaltyAmount + arrears,
    priorTicketCount: Math.max(0, priorSameTypeTicketCount),
    priorUnpaidTicketCount: Math.max(0, priorUnpaidTicketCount),
    courtDiscretionNote,
    ruleVersion: PENALTY_RULE_VERSION,
  }
}
