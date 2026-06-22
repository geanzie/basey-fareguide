import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, radii } from './theme';

interface Props extends Pick<TextInputProps, 'autoCapitalize' | 'keyboardType'> {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChangeText, placeholder = 'Search…', ...rest }: Props) {
  return (
    <TextInput
      style={s.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      clearButtonMode="while-editing"
      {...rest}
    />
  );
}

const s = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 14,
    color: colors.textStrong,
    backgroundColor: colors.surface,
  },
});
