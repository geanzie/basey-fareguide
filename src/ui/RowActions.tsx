import { View, StyleSheet } from 'react-native';

/** Wrapping row of small action buttons for a list card. */
export default function RowActions({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
