import { useId } from "react";

const C = {
  forest: "#14532D", leaf: "#16A34A", straw: "#E3C07A", strawLight: "#F3E6C4",
  red: "#B8322A", ink: "#1C1917", cream: "#F7F2E7", muted: "#57534E",
};

type Tone = "light" | "dark";

/** The Banig Ticket mark. Use tone="dark" on green or dark backgrounds. */
export function LogoMark({ size = 40, tone = "light" }: { size?: number; tone?: Tone }) {
  const id = useId().replace(/:/g, "");
  const ticket = tone === "dark" ? C.strawLight : C.forest;
  const detail = tone === "dark" ? C.forest : C.strawLight;
  const small = size < 40; // weave turns to mush at small sizes
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Basey FareCheck">
      <defs>
        <pattern id={`wv${id}`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill={C.straw} />
          <rect width="5" height="5" fill={C.red} />
          <rect x="5" y="5" width="5" height="5" fill={C.red} />
          <path d="M0 5h10M5 0v10" stroke="#7A2418" strokeWidth="0.6" strokeOpacity="0.45" fill="none" />
        </pattern>
        <mask id={`ct${id}`}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="10" cy="60" r="8" fill="#000" />
          <circle cx="110" cy="60" r="8" fill="#000" />
        </mask>
      </defs>
      <rect x="10" y="26" width="100" height="68" rx="10" fill={ticket} mask={`url(#ct${id})`} />
      {small ? (
        <rect x="21" y="34" width="21" height="52" rx="3" fill={C.red} />
      ) : (
        <>
          <rect x="22" y="34" width="20" height="52" rx="3" fill={`url(#wv${id})`} />
          <path d="M49 36v48" stroke={detail} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 6" fill="none" />
        </>
      )}
      <path d="M59 61l10 10 23-23" stroke={detail} strokeWidth={small ? 13 : 10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Mark + wordmark. Set the font on a parent (see README) or pass className. */
export function Logo({ size = 44, tone = "light", tagline = false, className }: {
  size?: number; tone?: Tone; tagline?: boolean; className?: string;
}) {
  const dark = tone === "dark";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3 }}>
      <LogoMark size={size} tone={tone} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{ fontWeight: 800, fontSize: size * 0.5, letterSpacing: "-0.025em" }}>
          <span style={{ color: dark ? C.cream : C.ink }}>Fare</span>
          <span style={{ color: dark ? C.straw : C.forest }}>Check</span>
        </span>
        {tagline && (
          <span style={{ fontSize: Math.max(10, size * 0.2), marginTop: 4, color: dark ? "#C9D8CC" : C.muted }}>
            Husto nga plete · Basey, Samar
          </span>
        )}
      </span>
    </span>
  );
}
