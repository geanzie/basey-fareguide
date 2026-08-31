/**
 * Registration option lists and the current Privacy Notice version.
 *
 * Lifted out of app/register.tsx so the social sign-up completion screen uses
 * the same values rather than a second copy that can drift.
 */

export const ID_TYPES = [
  'NATIONAL_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'VOTERS_ID',
  'SSS_ID', 'PHILHEALTH_ID', 'TIN_ID', 'POSTAL_ID', 'STUDENT_ID',
] as const;

export const ID_TYPE_LABELS: Record<typeof ID_TYPES[number], string> = {
  NATIONAL_ID: 'National ID',
  DRIVERS_LICENSE: "Driver's License",
  PASSPORT: 'Passport',
  VOTERS_ID: "Voter's ID",
  SSS_ID: 'SSS ID',
  PHILHEALTH_ID: 'PhilHealth ID',
  TIN_ID: 'TIN ID',
  POSTAL_ID: 'Postal ID',
  STUDENT_ID: 'Student ID',
};

/**
 * Basey's 51 barangays, spelled exactly as the municipal shapefile
 * (frontend/src/data/Barangay.shp.json) and the Place dataset spell them, so a
 * registered barangay joins to a Place. Do not re-spell entries here alone.
 *
 * "Nouvelas Occidental" is an alias for Balud and was previously listed instead
 * of it. Bangon is a sitio of Can-Manila, not a barangay.
 */
export const BARANGAYS = [
  'Amandayehan', 'Anglit', 'Bacubac', 'Balante', 'Balo-Og', 'Balud', 'Basiao',
  'Baybay', 'Binungtu-An', 'Buenavista', 'Bulao', 'Burgos', 'Buscada',
  'Cambayan', 'Can-Abay', 'Can-Manila', 'Canca-Iyas', 'Catadman', 'Cogon',
  'Del Pilar', 'Dolongan', 'Guintigui-An', 'Guirang', 'Iba', 'Inuntan',
  'Lawa-An', 'Lo-Og', 'Loyo', 'Mabini', 'Magallanes', 'Manlilinab', 'May-It',
  'Mercado', 'Mongabong', 'New San Agustin', 'Old San Agustin', 'Palaypay',
  'Panugmonon', 'Pelit', 'Roxas', 'Salvacion', 'San Antonio', 'San Fernando',
  'Sawa', 'Serum', 'Sogponon', 'Sugca', 'Sulod', 'Tinaogan', 'Tingib',
  'Villa Aurora',
];

export const PRIVACY_NOTICE_VERSION = '2026-04-21' as const;
