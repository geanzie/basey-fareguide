/**
 * What Municipal Ordinance No. 105, Series of 2023 says about fares, in plain
 * language, for the public landing page. Only fare provisions are here: the
 * franchise, fee and registration rules are for operators, and the full text
 * is one click away at /ordinance. Every line cites its section so a reader
 * can check it against public/ordinances/municipal-ordinance-no-105.pdf.
 *
 * Sec. 24's fare figures are left out on purpose: the fare in force is the
 * current FareRateVersion, which the landing page reads live. Printing the
 * 2023 figures next to it would show two different fares for the same ride.
 */

export interface OrdinancePoint {
  section: string
  text: string
}

export const ORDINANCE_105_FACTS = {
  amends: 'Ordinance No. 16, Series of 2017',
  sponsor: 'Hon. Ariel P. Duran',
  enacted: '3 July 2023',
  vote: 'Enacted unanimously by the Sangguniang Bayan of Basey',
  effectivity: 'Took effect 15 days after approval',
} as const

export const ORDINANCE_105_FARE_POINTS: OrdinancePoint[] = [
  { section: '2', text: 'Applies to every tricycle and motorcycle for hire operating in Basey.' },
  {
    section: '7',
    text: 'Only the Sangguniang Bayan sets and adjusts fares, and only after a public hearing.',
  },
  {
    section: '24',
    text: 'Fares are charged per passenger, with a discount for students, senior citizens and persons with disability.',
  },
  { section: '19(k)', text: 'Drivers charge the fare the ordinance approves, nothing more.' },
  { section: '19(n)', text: 'The approved fare is posted where passengers can see it.' },
  {
    section: '29, 30',
    text: 'Breaking these rules is a ground to cancel the franchise, decided by the Sangguniang Bayan in session.',
  },
]
