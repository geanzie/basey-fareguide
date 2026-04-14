export interface OrdinanceResource {
  title: string
  shortTitle: string
  summary: string
  pdfUrl: string
  effectiveLabel: string
  lastUpdatedLabel?: string
}

export const ordinanceResource: OrdinanceResource = {
  title:
    'An Ordinance Amending Ordinance No. 16, Series of 2017 Regulating the Operation of Tricycle-for-Hire and Motorcycle-for-Hire Operating or Plying Within the Municipality of Basey, Province of Samar',
  shortTitle: 'Municipal Ordinance No. 105',
  summary:
    'Official Basey municipal ordinance covering transport-service rules, fare compliance, and violation penalties for tricycles-for-hire and motorcycles-for-hire.',
  pdfUrl: '/ordinances/municipal-ordinance-no-105.pdf',
  effectiveLabel: 'Municipal Ordinance No. 105, Series of 2023',
}