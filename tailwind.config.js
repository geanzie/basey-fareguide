/** @type {import('tailwindcss').Config} */
// Design tokens ported from mobile/src/ui/theme.ts — keep the two in sync.
// Spacing intentionally maps onto Tailwind defaults:
//   mobile spacing xs4/sm8/md12/lg16/xl24 -> p-1 / p-2 / p-3 / p-4 / p-6
// Text uses the stock Tailwind ramp only (no arbitrary `text-[13px]` literals),
// because every step below is multiplied by --text-scale. See the fontSize note.

// Every type step is scaled by --text-scale (globals.css: 1 on desktop, 1.15
// below the lg breakpoint) so phone text reads larger for elderly commuters
// without touching the root font-size — spacing and layout geometry stay put.
// Line-height is scaled with the size so leading tracks the text.
// A size written as an arbitrary value (`text-[13px]`) opts out of all of this;
// use a named step instead.
const scaled = (rem, leadingRem) => [
  `calc(${rem}rem * var(--text-scale))`,
  { lineHeight: `calc(${leadingRem}rem * var(--text-scale))` },
]

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/ui/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#16a34a', dark: '#15803d' },
        danger: { DEFAULT: '#dc2626', soft: '#fef2f2', softBorder: '#fecaca' },
        warning: { DEFAULT: '#f59e0b', dark: '#b45309' },
        info: '#3b82f6',
        brandPurple: '#8b5cf6',
        ink: { strong: '#0f172a', body: '#374151', muted: '#64748b', faint: '#94a3b8' },
        surface: {
          bg: '#f1f5f9',
          DEFAULT: '#ffffff',
          alt: '#f8fafc',
          tint: '#f0fdf4',
          border: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Mirrors Tailwind's stock ramp, wrapped in the --text-scale multiplier.
      // Any step left out here keeps its fixed stock value and silently stops
      // scaling, so keep this covering every size the app actually uses.
      fontSize: {
        xs: scaled(0.75, 1),
        sm: scaled(0.875, 1.25),
        base: scaled(1, 1.5),
        lg: scaled(1.125, 1.75),
        xl: scaled(1.25, 1.75),
        '2xl': scaled(1.5, 2),
        '3xl': scaled(1.875, 2.25),
        '4xl': scaled(2.25, 2.5),
        // Tailwind's stock 5xl/6xl use a unitless line-height, which already
        // tracks the font size — scaling it would be wrong (and 1rem is not 1).
        '5xl': [`calc(3rem * var(--text-scale))`, { lineHeight: '1' }],
        '6xl': [`calc(3.75rem * var(--text-scale))`, { lineHeight: '1' }],
      },
      // Surface radii. `band` is the GradientHeader's bottom; `plate` is the
      // content surface floated over it — 4px tighter so it reads as sitting in
      // front of the band (concentric radius = outer - offset).
      borderRadius: {
        card: '14px',
        plate: '20px',
        band: '24px',
        sheet: '28px',
      },
      // Named stacking layers. Anything `position: fixed` picks one of these
      // instead of a literal, so collisions are visible at a glance.
      zIndex: {
        nav: '40',
        fab: '45',
        sheet: '50',
        dialog: '60',
        overlay: '70',
        map: '500',
      },
      spacing: {
        'nav-mobile': 'var(--mobile-bottom-nav-height)',
        'safe-b': 'var(--mobile-safe-area-bottom)',
      },
      backgroundImage: {
        brand: 'linear-gradient(135deg, #0f172a 0%, #15803d 60%, #16a34a 100%)',
        'brand-soft': 'linear-gradient(135deg, #16a34a, #15803d)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04)',
        raised: '0 4px 8px rgba(0,0,0,0.2)',
      },
    },
  },
  plugins: [],
}
