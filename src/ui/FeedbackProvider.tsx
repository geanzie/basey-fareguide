import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow } from './theme';
import Button from './Button';

type Variant = 'success' | 'error' | 'warning' | 'confirm';

interface MessageOptions {
  /** Heading shown under the icon. */
  title?: string;
  /** Confirm/dismiss button label. */
  actionLabel?: string;
  /** Fired after the modal is dismissed (e.g. navigation). */
  onClose?: () => void;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render the confirm action in a destructive (red) tone. */
  destructive?: boolean;
  /** Fired when the user presses the confirm action. */
  onConfirm: () => void;
  /** Fired when the modal is dismissed without confirming (cancel/backdrop). */
  onClose?: () => void;
}

interface FeedbackContextValue {
  showSuccess: (message: string, options?: MessageOptions) => void;
  showError: (message: string, options?: MessageOptions) => void;
  showWarning: (message: string, options?: MessageOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

interface ActiveState {
  variant: Variant;
  title: string;
  message: string;
  actionLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
}

const TONE: Record<
  Exclude<Variant, 'confirm'> | 'confirmSafe' | 'confirmDanger',
  { chip: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  success: { chip: '#dcfce7', icon: 'checkmark-circle', color: colors.primary },
  error: { chip: '#fee2e2', icon: 'alert-circle', color: colors.danger },
  warning: { chip: '#fef3c7', icon: 'warning', color: colors.warningDark },
  confirmSafe: { chip: '#dbeafe', icon: 'help-circle', color: colors.info },
  confirmDanger: { chip: '#fee2e2', icon: 'alert-circle', color: colors.danger },
};

const DEFAULT_TITLE: Record<Variant, string> = {
  success: 'Success',
  error: 'Something went wrong',
  warning: 'Heads up',
  confirm: 'Please confirm',
};

/**
 * App-wide feedback dialogs. Replaces the native rectangular `Alert.alert`
 * popups with a themed, animated card that matches the rest of the mobile UI.
 * Use via `useFeedback()`: `showSuccess`, `showError`, `showWarning`,
 * `showConfirm`.
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveState | null>(null);
  const [visible, setVisible] = useState(false);
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const present = useCallback((next: ActiveState) => {
    setActive(next);
    setVisible(true);
  }, []);

  const showMessage = useCallback(
    (variant: Exclude<Variant, 'confirm'>) =>
      (message: string, options?: MessageOptions) => {
        present({
          variant,
          message,
          title: options?.title ?? DEFAULT_TITLE[variant],
          actionLabel: options?.actionLabel ?? 'Done',
          onClose: options?.onClose,
        });
      },
    [present],
  );

  const showSuccess = useCallback(showMessage('success'), [showMessage]);
  const showError = useCallback(showMessage('error'), [showMessage]);
  const showWarning = useCallback(showMessage('warning'), [showMessage]);

  const showConfirm = useCallback(
    (options: ConfirmOptions) => {
      present({
        variant: 'confirm',
        message: options.message,
        title: options.title ?? DEFAULT_TITLE.confirm,
        actionLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        destructive: options.destructive,
        onConfirm: options.onConfirm,
        onClose: options.onClose,
      });
    },
    [present],
  );

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [visible, scale, opacity]);

  const dismiss = useCallback(() => {
    const onClose = active?.onClose;
    setVisible(false);
    setActive(null);
    onClose?.();
  }, [active]);

  const handleConfirm = useCallback(() => {
    const onConfirm = active?.onConfirm;
    setVisible(false);
    setActive(null);
    onConfirm?.();
  }, [active]);

  const isConfirm = active?.variant === 'confirm';
  const toneKey =
    active?.variant === 'confirm'
      ? active.destructive
        ? 'confirmDanger'
        : 'confirmSafe'
      : active?.variant ?? 'success';
  const tone = TONE[toneKey];

  return (
    <FeedbackContext.Provider value={{ showSuccess, showError, showWarning, showConfirm }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={s.wrap}>
          <Pressable style={s.backdrop} onPress={dismiss} />
          <Animated.View style={[s.card, { opacity, transform: [{ scale }] }]}>
            <View style={[s.iconChip, { backgroundColor: tone.chip }]}>
              <Ionicons name={tone.icon} size={44} color={tone.color} />
            </View>
            <Text style={s.title}>{active?.title}</Text>
            {active?.message ? <Text style={s.message}>{active.message}</Text> : null}

            {isConfirm ? (
              <View style={s.buttonRow}>
                <Button
                  label={active?.cancelLabel ?? 'Cancel'}
                  onPress={dismiss}
                  variant="secondary"
                  style={s.rowButton}
                />
                <Button
                  label={active?.actionLabel ?? 'Confirm'}
                  onPress={handleConfirm}
                  variant="primary"
                  style={[
                    s.rowButton,
                    active?.destructive ? { backgroundColor: colors.danger } : null,
                  ]}
                />
              </View>
            ) : (
              <Button
                label={active?.actionLabel ?? 'Done'}
                onPress={dismiss}
                variant="primary"
                style={s.button}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return ctx;
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.xl + 8,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...shadow.raised,
  },
  iconChip: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.textStrong, textAlign: 'center' },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: { marginTop: 22, alignSelf: 'stretch' },
  buttonRow: { marginTop: 22, flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  rowButton: { flex: 1 },
});
