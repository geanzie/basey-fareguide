import { useId } from "react";

const C = {
  forest: "#14532D", leaf: "#16A34A", straw: "#E3C07A", strawLight: "#F3E6C4",
  red: "#B8322A", ink: "#1C1917", cream: "#F7F2E7", muted: "#57534E",
};

type Tone = "light" | "dark";

const BANIG = (
  <>
    <rect x="22" y="34" width="20" height="52" fill="#E6D3A8" /><rect x="22.0" y="34.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="24.5" y="34.0" width="2.5" height="2.5" fill="#F39A2B" /><rect x="29.5" y="34.0" width="5.0" height="2.5" fill="#4B2E83" /><rect x="37.0" y="34.0" width="2.5" height="2.5" fill="#F39A2B" /><rect x="39.5" y="34.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="24.5" y="36.5" width="2.5" height="2.5" fill="#EE6A55" /><rect x="27.0" y="36.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="34.5" y="36.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="37.0" y="36.5" width="2.5" height="2.5" fill="#EE6A55" /><rect x="22.0" y="39.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="27.0" y="39.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="29.5" y="39.0" width="5.0" height="2.5" fill="#F39A2B" /><rect x="34.5" y="39.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="39.5" y="39.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="22.0" y="41.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="24.5" y="41.5" width="2.5" height="2.5" fill="#37B7C3" /><rect x="29.5" y="41.5" width="5.0" height="2.5" fill="#EE6A55" /><rect x="37.0" y="41.5" width="2.5" height="2.5" fill="#37B7C3" /><rect x="39.5" y="41.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="24.5" y="44.0" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="27.0" y="44.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="34.5" y="44.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="37.0" y="44.0" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="22.0" y="46.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="27.0" y="46.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="29.5" y="46.5" width="5.0" height="2.5" fill="#37B7C3" /><rect x="34.5" y="46.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="39.5" y="46.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="24.5" y="49.0" width="2.5" height="2.5" fill="#4B2E83" /><rect x="29.5" y="49.0" width="5.0" height="2.5" fill="#F6F1E6" /><rect x="37.0" y="49.0" width="2.5" height="2.5" fill="#4B2E83" /><rect x="22.0" y="51.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="27.0" y="51.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="34.5" y="51.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="39.5" y="51.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="22.0" y="54.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="24.5" y="54.0" width="2.5" height="2.5" fill="#F39A2B" /><rect x="29.5" y="54.0" width="5.0" height="2.5" fill="#4B2E83" /><rect x="37.0" y="54.0" width="2.5" height="2.5" fill="#F39A2B" /><rect x="39.5" y="54.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="24.5" y="56.5" width="2.5" height="2.5" fill="#EE6A55" /><rect x="27.0" y="56.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="34.5" y="56.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="37.0" y="56.5" width="2.5" height="2.5" fill="#EE6A55" /><rect x="22.0" y="59.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="27.0" y="59.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="29.5" y="59.0" width="5.0" height="2.5" fill="#F39A2B" /><rect x="34.5" y="59.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="39.5" y="59.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="22.0" y="61.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="24.5" y="61.5" width="2.5" height="2.5" fill="#37B7C3" /><rect x="29.5" y="61.5" width="5.0" height="2.5" fill="#EE6A55" /><rect x="37.0" y="61.5" width="2.5" height="2.5" fill="#37B7C3" /><rect x="39.5" y="61.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="24.5" y="64.0" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="27.0" y="64.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="34.5" y="64.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="37.0" y="64.0" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="22.0" y="66.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="27.0" y="66.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="29.5" y="66.5" width="5.0" height="2.5" fill="#37B7C3" /><rect x="34.5" y="66.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="39.5" y="66.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="24.5" y="69.0" width="2.5" height="2.5" fill="#4B2E83" /><rect x="29.5" y="69.0" width="5.0" height="2.5" fill="#F6F1E6" /><rect x="37.0" y="69.0" width="2.5" height="2.5" fill="#4B2E83" /><rect x="22.0" y="71.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="27.0" y="71.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="34.5" y="71.5" width="2.5" height="2.5" fill="#4B2E83" /><rect x="39.5" y="71.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="22.0" y="74.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="24.5" y="74.0" width="2.5" height="2.5" fill="#F39A2B" /><rect x="29.5" y="74.0" width="5.0" height="2.5" fill="#4B2E83" /><rect x="37.0" y="74.0" width="2.5" height="2.5" fill="#F39A2B" /><rect x="39.5" y="74.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="24.5" y="76.5" width="2.5" height="2.5" fill="#EE6A55" /><rect x="27.0" y="76.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="34.5" y="76.5" width="2.5" height="2.5" fill="#F39A2B" /><rect x="37.0" y="76.5" width="2.5" height="2.5" fill="#EE6A55" /><rect x="22.0" y="79.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="27.0" y="79.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="29.5" y="79.0" width="5.0" height="2.5" fill="#F39A2B" /><rect x="34.5" y="79.0" width="2.5" height="2.5" fill="#EE6A55" /><rect x="39.5" y="79.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="22.0" y="81.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="24.5" y="81.5" width="2.5" height="2.5" fill="#37B7C3" /><rect x="29.5" y="81.5" width="5.0" height="2.5" fill="#EE6A55" /><rect x="37.0" y="81.5" width="2.5" height="2.5" fill="#37B7C3" /><rect x="39.5" y="81.5" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="24.5" y="84.0" width="2.5" height="2.5" fill="#F6F1E6" /><rect x="27.0" y="84.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="34.5" y="84.0" width="2.5" height="2.5" fill="#37B7C3" /><rect x="37.0" y="84.0" width="2.5" height="2.5" fill="#F6F1E6" /><path d="M22.0 34.0h2.5v2.5h-2.5zM27.0 34.0h2.5v2.5h-2.5zM32.0 34.0h2.5v2.5h-2.5zM37.0 34.0h2.5v2.5h-2.5zM24.5 36.5h2.5v2.5h-2.5zM29.5 36.5h2.5v2.5h-2.5zM34.5 36.5h2.5v2.5h-2.5zM39.5 36.5h2.5v2.5h-2.5zM22.0 39.0h2.5v2.5h-2.5zM27.0 39.0h2.5v2.5h-2.5zM32.0 39.0h2.5v2.5h-2.5zM37.0 39.0h2.5v2.5h-2.5zM24.5 41.5h2.5v2.5h-2.5zM29.5 41.5h2.5v2.5h-2.5zM34.5 41.5h2.5v2.5h-2.5zM39.5 41.5h2.5v2.5h-2.5zM22.0 44.0h2.5v2.5h-2.5zM27.0 44.0h2.5v2.5h-2.5zM32.0 44.0h2.5v2.5h-2.5zM37.0 44.0h2.5v2.5h-2.5zM24.5 46.5h2.5v2.5h-2.5zM29.5 46.5h2.5v2.5h-2.5zM34.5 46.5h2.5v2.5h-2.5zM39.5 46.5h2.5v2.5h-2.5zM22.0 49.0h2.5v2.5h-2.5zM27.0 49.0h2.5v2.5h-2.5zM32.0 49.0h2.5v2.5h-2.5zM37.0 49.0h2.5v2.5h-2.5zM24.5 51.5h2.5v2.5h-2.5zM29.5 51.5h2.5v2.5h-2.5zM34.5 51.5h2.5v2.5h-2.5zM39.5 51.5h2.5v2.5h-2.5zM22.0 54.0h2.5v2.5h-2.5zM27.0 54.0h2.5v2.5h-2.5zM32.0 54.0h2.5v2.5h-2.5zM37.0 54.0h2.5v2.5h-2.5zM24.5 56.5h2.5v2.5h-2.5zM29.5 56.5h2.5v2.5h-2.5zM34.5 56.5h2.5v2.5h-2.5zM39.5 56.5h2.5v2.5h-2.5zM22.0 59.0h2.5v2.5h-2.5zM27.0 59.0h2.5v2.5h-2.5zM32.0 59.0h2.5v2.5h-2.5zM37.0 59.0h2.5v2.5h-2.5zM24.5 61.5h2.5v2.5h-2.5zM29.5 61.5h2.5v2.5h-2.5zM34.5 61.5h2.5v2.5h-2.5zM39.5 61.5h2.5v2.5h-2.5zM22.0 64.0h2.5v2.5h-2.5zM27.0 64.0h2.5v2.5h-2.5zM32.0 64.0h2.5v2.5h-2.5zM37.0 64.0h2.5v2.5h-2.5zM24.5 66.5h2.5v2.5h-2.5zM29.5 66.5h2.5v2.5h-2.5zM34.5 66.5h2.5v2.5h-2.5zM39.5 66.5h2.5v2.5h-2.5zM22.0 69.0h2.5v2.5h-2.5zM27.0 69.0h2.5v2.5h-2.5zM32.0 69.0h2.5v2.5h-2.5zM37.0 69.0h2.5v2.5h-2.5zM24.5 71.5h2.5v2.5h-2.5zM29.5 71.5h2.5v2.5h-2.5zM34.5 71.5h2.5v2.5h-2.5zM39.5 71.5h2.5v2.5h-2.5zM22.0 74.0h2.5v2.5h-2.5zM27.0 74.0h2.5v2.5h-2.5zM32.0 74.0h2.5v2.5h-2.5zM37.0 74.0h2.5v2.5h-2.5zM24.5 76.5h2.5v2.5h-2.5zM29.5 76.5h2.5v2.5h-2.5zM34.5 76.5h2.5v2.5h-2.5zM39.5 76.5h2.5v2.5h-2.5zM22.0 79.0h2.5v2.5h-2.5zM27.0 79.0h2.5v2.5h-2.5zM32.0 79.0h2.5v2.5h-2.5zM37.0 79.0h2.5v2.5h-2.5zM24.5 81.5h2.5v2.5h-2.5zM29.5 81.5h2.5v2.5h-2.5zM34.5 81.5h2.5v2.5h-2.5zM39.5 81.5h2.5v2.5h-2.5zM22.0 84.0h2.5v2.5h-2.5zM27.0 84.0h2.5v2.5h-2.5zM32.0 84.0h2.5v2.5h-2.5zM37.0 84.0h2.5v2.5h-2.5z" fill="#000" fillOpacity="0.08"></path>
  </>
);
const BANIG_SIMPLE = (
  <>
    <rect x="21" y="34.00" width="21" height="13.30" fill="#4B2E83" /><rect x="21" y="47.00" width="21" height="13.30" fill="#F39A2B" /><rect x="21" y="60.00" width="21" height="13.30" fill="#EE6A55" /><rect x="21" y="73.00" width="21" height="13.30" fill="#37B7C3" />
  </>
);

/** The Banig Ticket mark. Use tone="dark" on green or dark backgrounds. */
export function LogoMark({ size = 40, tone = "light" }: { size?: number; tone?: Tone }) {
  const id = useId().replace(/:/g, "");
  const ticket = tone === "dark" ? C.strawLight : C.forest;
  const detail = tone === "dark" ? C.forest : C.strawLight;
  const small = size < 40; // weave turns to mush at small sizes
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Basey FareCheck">
      <defs>
        <clipPath id={`cl${id}`}>
          <rect x={small ? 21 : 22} y="34" width={small ? 21 : 20} height="52" rx="3" />
        </clipPath>
        <mask id={`ct${id}`}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="10" cy="60" r="8" fill="#000" />
          <circle cx="110" cy="60" r="8" fill="#000" />
        </mask>
      </defs>
      <rect x="10" y="26" width="100" height="68" rx="10" fill={ticket} mask={`url(#ct${id})`} />
      {/* Basey banig: stepped zigzag bands (indigo, marigold, coral, turquoise) on natural tikog */}
      <g clipPath={`url(#cl${id})`}>
        {small ? BANIG_SIMPLE : BANIG}
      </g>
      {!small && (
        <path d="M49 36v48" stroke={detail} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 6" fill="none" />
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
