import Svg, { Path } from 'react-native-svg';

/**
 * Provider marks for the social sign-in buttons. Paths mirror
 * `../../frontend/src/components/auth/SocialSignInButtons.tsx` so both clients
 * show the same logos; an unknown slug renders nothing rather than a fallback.
 */
const GoogleMark = ({ size }: { size: number }) => (
  <Svg viewBox="0 0 18 18" width={size} height={size}>
    <Path
      fill="#4285F4"
      d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
    />
    <Path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.93v2.33A9 9 0 0 0 9 18Z"
    />
    <Path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.93a9 9 0 0 0 0 8.1l3.04-2.33Z" />
    <Path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .93 4.95l3.04 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
    />
  </Svg>
);

const FacebookMark = ({ size }: { size: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path
      fill="#1877F2"
      d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c-3.01 0-4.79 1.83-4.79 4.72v2.32h2.8V24C19.61 23.1 24 18.1 24 12.07Z"
    />
  </Svg>
);

const MARKS: Record<string, ({ size }: { size: number }) => React.ReactElement> = {
  google: GoogleMark,
  facebook: FacebookMark,
};

export default function SocialIcon({ slug, size = 20 }: { slug: string; size?: number }) {
  const Mark = MARKS[slug];
  return Mark ? <Mark size={size} /> : null;
}
