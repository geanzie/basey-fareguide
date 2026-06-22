import type { ReactNode } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadow } from './theme';

type Variant = 'sheet' | 'center' | 'fullScreen';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  variant?: Variant;
  /** Sticky footer (e.g. submit/action buttons). */
  footer?: ReactNode;
  children: ReactNode;
  /** Wrap the body in a ScrollView. Default true. */
  scroll?: boolean;
  closeLabel?: string;
}

/**
 * Themed modal wrapper. Replaces the per-screen Modal + header + SafeAreaView
 * boilerplate. `center` renders a dimmed-backdrop dialog; `sheet` and
 * `fullScreen` slide up a full surface.
 */
export default function AppModal({
  visible,
  onClose,
  title,
  variant = 'sheet',
  footer,
  children,
  scroll = true,
  closeLabel = 'Close',
}: Props) {
  const header = title ? (
    <View style={s.header}>
      <Text style={s.title}>{title}</Text>
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={s.close}>{closeLabel}</Text>
      </Pressable>
    </View>
  ) : null;

  if (variant === 'center') {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={s.centerWrap}>
          <Pressable style={s.backdrop} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.centerCardWrap}
          >
            <View style={s.centerCard}>
              {header}
              {scroll ? (
                <ScrollView
                  contentContainerStyle={s.centerBody}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={s.centerBody}>{children}</View>
              )}
              {footer ? <View style={s.footer}>{footer}</View> : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={variant === 'fullScreen' ? 'fullScreen' : 'pageSheet'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.fullWrap} edges={['top', 'bottom']}>
        {header}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.flex}
        >
          {scroll ? (
            <ScrollView
              style={s.flex}
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[s.flex, s.body]}>{children}</View>
          )}
          {footer ? <View style={s.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textStrong },
  close: { color: colors.info, fontSize: 15, fontWeight: '600' },

  // sheet / fullScreen
  fullWrap: { flex: 1, backgroundColor: colors.surfaceAlt },
  body: { padding: 16 },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  // center
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  centerCardWrap: { width: '100%', maxWidth: 480 },
  centerCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
    overflow: 'hidden',
    maxHeight: '85%',
    ...shadow.raised,
  },
  centerBody: { padding: 16 },
});
