import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from './theme';

interface Props {
  /** Progress fraction, 0..1. Clamped. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** Small caption under the big percentage in the center. */
  centerLabel?: string;
}

/**
 * Lightweight progress ring built on react-native-svg (already a dep — no chart
 * library). The arc starts at 12 o'clock and sweeps clockwise.
 */
export default function DonutRing({
  percent,
  size = 120,
  strokeWidth = 12,
  color = colors.primary,
  trackColor = colors.border,
  centerLabel,
}: Props) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * clamped;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={s.center}>
        <Text style={[s.pct, { color }]}>{Math.round(clamped * 100)}%</Text>
        {centerLabel ? <Text style={s.label}>{centerLabel}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center' },
  pct: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 1 },
});
