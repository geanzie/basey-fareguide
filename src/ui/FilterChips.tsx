import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radii } from './theme';

export interface ChipOption {
  label: string;
  value: string;
}

interface Props {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Horizontally scrollable single-select chip row (status / type filters). */
export default function FilterChips({ options, value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[s.chip, active && s.chipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[s.text, active && s.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: '#f0fdf4', borderColor: colors.primary },
  text: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  textActive: { color: colors.primary },
});
