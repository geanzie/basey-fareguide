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

// ---- App features: vehicles, permits, enforcement, roles ----

// Jeepney — Vehicles, registry
export function IconJeepney({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6.5" cy="16.5" r="2"></circle><circle cx="17.5" cy="16.5" r="2"></circle><path d="M4.5 16.5H3V8.5a1 1 0 0 1 1-1h11.5V12h4.5a1 1 0 0 1 1 1v3.5h-1.5M8.5 16.5h7"></path><path d="M3 11.5h12.5M6.5 7.5v4M10 7.5v4"></path><path d="M2.5 5.5h14" stroke={accent}></path>
    </svg>
  );
}

// Multicab — Vehicle picker
export function IconMulticab({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6.5" cy="17" r="1.8"></circle><circle cx="17.5" cy="17" r="1.8"></circle><path d="M4.7 17H3v-5.5L5.5 7H19a1 1 0 0 1 1 1v9h-.7M8.3 17h7.4"></path><path d="M5.3 11.5l1.6-2.5H10v2.5z" stroke={accent}></path><path d="M13 9h4.5v2.5H13z"></path>
    </svg>
  );
}

// Bus — Vehicle picker
export function IconBus({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="5" y="3" width="14" height="15" rx="2"></rect><path d="M5 11.5h14"></path><path d="M8 5.8h8" stroke={accent}></path><path d="M8 14.8v.1M16 14.8v.1M7.5 18v2.5M16.5 18v2.5"></path>
    </svg>
  );
}

// Van — Vehicle picker
export function IconVan({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="6.5" cy="17" r="1.8"></circle><circle cx="17.5" cy="17" r="1.8"></circle><path d="M4.7 17H3v-4l3-5.5h12.5a2 2 0 0 1 2 2V17h-1.2M8.3 17h7.4"></path><path d="M6.5 12.5l2-3.5h11.5v3.5z" stroke={accent}></path><path d="M13.5 12.5V17"></path>
    </svg>
  );
}

// Permit sticker — Permit management
export function IconPermit({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 4h16v11l-5 5H4z"></path><path d="M15 20v-5h5" stroke={accent}></path><path d="M7 7h3v3H7zM13.5 7h3v3h-3zM7 13.5h3v3H7zM12.5 12.5v.1"></path>
    </svg>
  );
}

// QR scan — QR scanner
export function IconQrScan({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"></path><path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 16h3"></path><path d="M2.5 12h19" stroke={accent}></path>
    </svg>
  );
}

// Violation ticket — Tickets, unpaid
export function IconViolation({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M6 3h12v17.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"></path><path d="M9 7h6M9 10h6"></path><path d="M12 13v2.5M12 17.6v.1" stroke={accent}></path>
    </svg>
  );
}

// Ticket payment — Ticket payments
export function IconPayment({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2"></rect><path d="M5.5 9v.1M18.5 15v.1"></path><path d="M10.5 15.5v-7h2a2 2 0 0 1 0 4h-2M9 10.5h5.5" stroke={accent}></path>
    </svg>
  );
}

// Incident — Incident queues
export function IconIncident({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M7 18v-5a5 5 0 0 1 10 0v5"></path><path d="M5 18h14v2.5H5zM12 13v2"></path><path d="M12 3v2M4.5 6l1.4 1.4M19.5 6l-1.4 1.4" stroke={accent}></path>
    </svg>
  );
}

// Announcement — Announcements
export function IconAnnouncement({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M4 10v4h3l7 4V6l-7 4z"></path><path d="M7 14l1.5 5.5h2L9.5 14.8"></path><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5M19.8 7a7 7 0 0 1 0 10" stroke={accent}></path>
    </svg>
  );
}

// Traffic notice — Road advisories
export function IconTraffic({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M10 4.5h4L18 19H6z"></path><path d="M8.2 11h7.6" stroke={accent}></path><path d="M3.5 19.5h17M7.3 15h9.4"></path>
    </svg>
  );
}

// Fare calculator — Calculator
export function IconCalculator({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 6.5h8v3H8z" stroke={accent}></path><path d="M8.5 13v.1M12 13v.1M15.5 13v.1M8.5 17v.1M12 17v.1M15.5 17v.1"></path>
    </svg>
  );
}

// Trip history — History
export function IconHistory({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"></path><path d="M3 3.5V8h4.5"></path><path d="M12 7.5V12l3 2" stroke={accent}></path>
    </svg>
  );
}

// Evidence — Report uploads
export function IconEvidence({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.5-2h7L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"></path><circle cx="12" cy="13" r="3.5" stroke={accent}></circle>
    </svg>
  );
}

// Driver — Role badge
export function IconDriver({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="5.5" r="2.5"></circle><circle cx="12" cy="15.5" r="6"></circle><path d="M6 15.5h4.5M13.5 15.5H18M12 17v4.5"></path><circle cx="12" cy="15.5" r="1.5" stroke={accent}></circle>
    </svg>
  );
}

// Enforcer — Role badge
export function IconEnforcer({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"></path><path d="M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z" stroke={accent}></path>
    </svg>
  );
}

// Encoder — Role badge
export function IconEncoder({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="5" y="4.5" width="12" height="16.5" rx="1.5"></rect><path d="M9 3h4v3H9zM8 10h6M8 13h4"></path><path d="M14 20l5.5-5.5 1.5 1.5-5.5 5.5H14z" stroke={accent}></path>
    </svg>
  );
}

// Offline map — Map pack
export function IconOfflineMap({ size = 24, accent = ACCENT, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 6.5L8.5 4l7 2.5L21 4v13l-5.5 2.5-7-2.5L3 19.5z"></path><path d="M8.5 4v13M15.5 6.5V11"></path><path d="M15.5 12v7M13 16.5l2.5 2.5 2.5-2.5" stroke={accent}></path>
    </svg>
  );
}
