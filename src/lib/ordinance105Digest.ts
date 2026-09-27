import { PUBLIC_PENALTY_SCHEDULE } from '@/lib/incidents/penaltyRules'

/**
 * Plain-language digest of Municipal Ordinance No. 105, Series of 2023, for the
 * public landing page. Every line cites the section it comes from, so a reader
 * can check it against the PDF (public/ordinances/municipal-ordinance-no-105.pdf).
 *
 * Sec. 24's fare figures are left out on purpose: the fare in force is the
 * current FareRateVersion, which the landing page reads live. Printing the
 * 2023 figures next to it would show two different fares for the same ride.
 */

export interface OrdinancePoint {
  section: string
  text: string
}

export interface OrdinanceArticle {
  numeral: string
  title: string
  points: OrdinancePoint[]
}

export interface OrdinanceAmount {
  section: string
  label: string
  amount: string
  /** What the court may add on top of the fine; shown under the label. */
  note?: string
}

export const ORDINANCE_105_FACTS = {
  amends: 'Ordinance No. 16, Series of 2017',
  sponsor: 'Hon. Ariel P. Duran',
  enacted: '3 July 2023',
  vote: 'Enacted unanimously by the Sangguniang Bayan of Basey',
  effectivity: 'Took effect 15 days after approval',
  tricycleCap: 300,
} as const

export const ORDINANCE_105_ARTICLES: OrdinanceArticle[] = [
  {
    numeral: 'I',
    title: 'General provisions',
    points: [
      { section: '2', text: 'Covers every tricycle-for-hire operating or plying within Basey.' },
      {
        section: '7',
        text: 'The Sangguniang Bayan keeps the power to adjust fares after a public hearing, and to issue, suspend or cancel permits.',
      },
      {
        section: '8',
        text: 'One route for all tricycles and habal-habal in Basey, with the designated terminal at the municipal Public Terminal.',
      },
      { section: '9', text: 'Drivers and operators must also follow the Municipal Traffic Ordinance of Basey.' },
    ],
  },
  {
    numeral: 'II',
    title: 'Franchise',
    points: [
      {
        section: '10',
        text: 'No one may operate a tricycle-for-hire without a franchise from the Sangguniang Bayan, and only for a unit they own with valid LTO papers.',
      },
      {
        section: '11',
        text: 'A franchise runs for two years. A franchise still unrenewed one month after it expires is dropped.',
      },
      {
        section: '16',
        text: "The Motorized Tricycle Operator's Permit (MTOP) is issued by the Licensing Officer, approved by the Mayor, and expires every 31 December.",
      },
    ],
  },
  {
    numeral: 'III',
    title: 'Operating conditions',
    points: [
      {
        section: '19(a)',
        text: 'Each unit carries a reflectorized sidecar number, red on white, at the front and back.',
      },
      {
        section: '19(c)',
        text: "The vehicle's registration, the MTOP and the driver's license are displayed inside the sidecar or on the motorcycle.",
      },
      {
        section: '19(e)',
        text: 'Drivers wear shoes or sandals, a shirt and long pants. Motorcycle drivers wear a helmet and provide one to the passenger.',
      },
      { section: '19(f)', text: 'No driving under the influence of liquor or drugs.' },
      {
        section: '19(g), (h)',
        text: 'Only LTO-licensed drivers. Units convert to for-hire registration within 90 days of approval.',
      },
      {
        section: '19(i)',
        text: 'Operators carry common carrier insurance for passengers and third parties.',
      },
      { section: '19(n)', text: 'The authorized fare rate is displayed where passengers can see it.' },
      {
        section: '19(m)',
        text: 'No tricycle-for-hire on national highways unless the Sangguniang Bayan allows it for lack of another route.',
      },
      {
        section: '20',
        text: 'Operators must be Filipino citizens, or entities with at least 60% Filipino equity, and attend the franchising seminar.',
      },
    ],
  },
  {
    numeral: 'IV',
    title: 'Fees, charges and the fare guide',
    points: [
      { section: '22', text: 'Fees are paid on filing, within the first 20 days of January each year.' },
      {
        section: '24',
        text: 'Sets the fare guide per passenger, with a discount for students, senior citizens and persons with disability. The rate in force today is shown above.',
      },
    ],
  },
  {
    numeral: 'V',
    title: 'Non-transferability',
    points: [
      {
        section: '26',
        text: 'A franchise may pass only to a relative within the fourth civil degree who lives in Basey.',
      },
      {
        section: '28',
        text: 'Selling a franchise, using a dummy or renting one out is illegal and permanently revokes it.',
      },
    ],
  },
  {
    numeral: 'VI',
    title: 'Cancellation and revocation',
    points: [
      {
        section: '29',
        text: 'Grounds include breaking this ordinance or the franchise terms, an unregistered unit, unpaid fees and non-renewal.',
      },
      {
        section: '30',
        text: 'Cancellation is read in session of the Sangguniang Bayan, and does not bar other legal action.',
      },
    ],
  },
  {
    numeral: 'VII',
    title: 'Administration and random checks',
    points: [
      {
        section: '31',
        text: 'The Committees on Transportation and on Franchising oversee compliance.',
      },
      {
        section: '32',
        text: 'Traffic enforcers and police may stop a unit for a clear violation, suspected intoxication, or involvement in an accident or crime.',
      },
    ],
  },
  {
    numeral: 'VIII',
    title: 'Penal and transitory provisions',
    points: [
      { section: '33', text: 'Fines for operating without a franchise and MTOP, with a cancelled franchise, or by fraud.' },
      { section: '34', text: `The number of tricycles in Basey stays capped at ${ORDINANCE_105_FACTS.tricycleCap}.` },
    ],
  },
]

export const ORDINANCE_105_FEES: OrdinanceAmount[] = [
  { section: '21(a)', label: 'Annual franchise fee, per unit (first 5 units)', amount: '₱200' },
  { section: '21(a)', label: 'Each additional unit', amount: '+₱50' },
  { section: '21(a)', label: 'Filing fee, per unit', amount: '₱100' },
  { section: '21(a)', label: 'Inspection fee, per unit', amount: '₱100' },
  { section: '21(a)', label: 'Fare adjustment fee, per unit', amount: '₱100' },
  { section: '21(a)', label: 'Health certificate', amount: '₱100' },
  { section: '23', label: 'Replacing a lost franchise', amount: '₱100' },
  { section: '26', label: 'Franchise transfer, per unit', amount: '₱200' },
  { section: '11', label: 'Late renewal, up to 15 days', amount: '₱200' },
  { section: '11', label: 'Late renewal, 16 days to 1 month', amount: '₱300' },
]

function peso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`
}

/**
 * Sec. 33(a) amounts come from the enforcement schedule so the landing page
 * and the tickets enforcers issue can never disagree.
 */
export const ORDINANCE_105_PENALTIES: OrdinanceAmount[] = [
  ...PUBLIC_PENALTY_SCHEDULE.map((tier) => ({
    section: '33(a)',
    label: `No franchise and no MTOP, ${tier.label}`,
    amount: peso(tier.penaltyAmount),
    ...(tier.offenseTier === 'THIRD_PLUS'
      ? { note: "Or 30 days' imprisonment, or both, at the court's discretion" }
      : {}),
  })),
  { section: '33(b)', label: 'Operating with a cancelled franchise', amount: 'At least ₱2,500' },
  { section: '33(c)', label: 'Deceit or fraud in a franchise application', amount: 'At least ₱2,500' },
  {
    section: '28',
    label: 'Selling, renting or using a dummy franchise',
    amount: '₱2,000',
    note: "Or up to 1 month's imprisonment, or both, at the court's discretion",
  },
]
