import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radii, shadow } from './theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Standard list-row / content surface. */
export default function Card({ children, style }: Props) {
  return <View style={[s.card, style]}>{children}</View>;
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    gap: 4,
    ...shadow.card,
  },
});
