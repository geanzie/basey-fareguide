import { useState } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

/**
 * Password field with a show/hide eye toggle for verification.
 * Forwards all TextInputProps; the caller's `style` styles the input. Right
 * padding is appended so the eye icon never overlaps the value.
 */
export default function PasswordInput({ style, ...props }: TextInputProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={s.wrap}>
      <TextInput
        {...props}
        secureTextEntry={!show}
        style={[style, s.inputPad]}
      />
      <Pressable
        onPress={() => setShow((v) => !v)}
        hitSlop={10}
        style={s.icon}
        accessibilityRole="button"
        accessibilityLabel={show ? 'Hide password' : 'Show password'}
      >
        <Ionicons
          name={show ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={colors.textFaint}
        />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  inputPad: { paddingRight: 44 },
  icon: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
