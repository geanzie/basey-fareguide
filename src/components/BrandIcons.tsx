import type { SVGProps } from "react";

// Basey FareCheck icon set — 24px grid, 1.75 stroke.
// Main lines follow the text color (currentColor); one detail uses the accent.
const ACCENT = "#B8322A"; // banig red

type IconProps = SVGProps<SVGSVGElement> & { size?: number; accent?: string };

export function IconTricycle({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6" cy="18" r="2.5"></circle><circle cx="17.5" cy="18" r="2.5"></circle><path d="M2.5 9h3M4.5 9l1.5 6.5M6 15.5h5M11 15.5V8M20.5 15.5V8M11 15.5h9.5M11 11.5h9.5"></path><path d="M9.5 8q6.25-2.5 12.5 0" stroke={accent}></path>
    </svg>
  );
}

export function IconHabal({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="5" cy="17" r="3"></circle><circle cx="19" cy="17" r="3"></circle><path d="M5 17l4-6h6.5l3.5 6"></path><path d="M15.5 11l-1.5-4h3"></path><path d="M7.5 9h5.5" stroke={accent}></path>
    </svg>
  );
}

export function IconBangka({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 13h16l-2.5 4.5h-11z"></path><path d="M7 13V8.5h10V13"></path><path d="M2 11h20" stroke={accent}></path><path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"></path>
    </svg>
  );
}

export function IconRoute({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="5.5" cy="18.5" r="2"></circle><path d="M7.5 18.5h5a3 3 0 0 0 3-3v-3" strokeDasharray="2 2.6" stroke={accent}></path><path d="M15.5 11.5c-1.8-1.7-3-3.2-3-4.5a3 3 0 1 1 6 0c0 1.3-1.2 2.8-3 4.5z"></path>
    </svg>
  );
}

export function IconFareCheck({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z"></path><path d="M8.5 12l2.5 2.5 4.5-5" stroke={accent}></path>
    </svg>
  );
}

export function IconOrdinance({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 3h8l4 4v14H6z"></path><path d="M14 3v4h4"></path><path d="M9 11h6M9 14h3.5"></path><circle cx="14.5" cy="17" r="2" stroke={accent}></circle>
    </svg>
  );
}

export function IconDistance({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 17L17 3l4 4L7 21z"></path><path d="M7.5 12.5l2 2M10.5 9.5l1.5 1.5M13.5 6.5l2 2" stroke={accent}></path>
    </svg>
  );
}

export function IconDiscount({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12.5 3H5a2 2 0 0 0-2 2v7.5l9 9 9.5-9.5z"></path><circle cx="7.5" cy="7.5" r="1.2"></circle><path d="M10 16l5-5" stroke={accent}></path><circle cx="10.5" cy="11.5" r="0.9"></circle><circle cx="14.5" cy="15.5" r="0.9"></circle>
    </svg>
  );
}

export function IconBarangay({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 21.5c-4-3.5-7-7-7-10.5a7 7 0 0 1 14 0c0 3.5-3 7-7 10.5z"></path><path d="M8.5 10.5L12 7l3.5 3.5" stroke={accent}></path><path d="M9.5 10v3.5h5V10"></path>
    </svg>
  );
}

export function IconNight({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z"></path><path d="M17 4v3M15.5 5.5h3" stroke={accent}></path>
    </svg>
  );
}

export function IconLuggage({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="4" y="8" width="16" height="12" rx="2"></rect><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8"></path><path d="M4 13h16" stroke={accent}></path>
    </svg>
  );
}

export function IconReport({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 21V4"></path><path d="M5 4h11l-2 3.5 2 3.5H5" stroke={accent}></path>
    </svg>
  );
}
