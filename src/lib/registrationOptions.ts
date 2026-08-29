/**
 * Shared registration option lists.
 *
 * Lifted out of RegisterForm so the social sign-up completion form uses the
 * same values rather than a second copy that can drift.
 */

export const BARANGAYS = [
  'Amandayehan', 'Anglit', 'Bacubac', 'Baloog', 'Basiao', 'Buenavista', 'Burgos',
  'Cambayan', 'Can-abay', 'Cancaiyas', 'Canmanila', 'Catadman', 'Cogon', 'Dolongan',
  'Guintigui-an', 'Guirang', 'Balante', 'Iba', 'Inuntan', 'Loog', 'Mabini',
  'Magallanes', 'Manlilinab', 'Del Pilar', 'May-it', 'Mongabong', 'New San Agustin',
  'Nouvelas Occidental', 'Old San Agustin', 'Panugmonon', 'Pelit',
  'Baybay (Poblacion)', 'Buscada (Poblacion)', 'Lawa-an (Poblacion)',
  'Loyo (Poblacion)', 'Mercado (Poblacion)', 'Palaypay (Poblacion)',
  'Sulod (Poblacion)', 'Roxas', 'Salvacion', 'San Antonio', 'San Fernando', 'Sawa',
  'Serum', 'Sugca', 'Sugponon', 'Tinaogan', 'Tingib', 'Villa Aurora', 'Binongtu-an',
  'Bulao',
]

export const ID_TYPES: Array<[string, string]> = [
  ['NATIONAL_ID', 'National ID (PhilID)'],
  ['DRIVERS_LICENSE', "Driver's License"],
  ['PASSPORT', 'Passport'],
  ['VOTERS_ID', "Voter's ID"],
  ['SSS_ID', 'SSS ID'],
  ['PHILHEALTH_ID', 'PhilHealth ID'],
  ['TIN_ID', 'TIN ID'],
  ['POSTAL_ID', 'Postal ID'],
  ['STUDENT_ID', 'Student ID'],
]
