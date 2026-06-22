import { View, Text, StyleSheet } from 'react-native';
import { radii, statusColor } from './theme';

interface Props {
  label: string;
  /** Override the auto status color. */
  color?: string;
}

/** Status pill. Color resolves from the shared statusColor() map by default. */
export default function Badge({ label, color }: Props) {
  const c = color ?? statusColor(label);
  return (
    <View style={[s.badge, { backgroundColor: c + '22' }]}>
      <Text style={[s.text, { color: c }]}>{label.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700' },
});
