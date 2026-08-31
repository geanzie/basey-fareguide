import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/ui/Button';
import { colors, radii, spacing, text } from '@/ui/theme';
import type { FarePolicySnapshot } from '@/types/fare';

interface Props {
  /** The last policy the server sent, or null if this device never saw one. */
  farePolicy: FarePolicySnapshot | null;
  onRetry: () => void;
}

const peso = (n: number) => `₱${n.toFixed(2)}`;

/**
 * What the rider sees when there is no connection and no exact distance for
 * their trip.
 *
 * It shows no fare, on purpose. Every distance this app can reach offline is
 * one the server itself would have returned; anything else would be a guess,
 * and a guessed fare that disagrees with the driver's app is an argument at the
 * roadside under Ordinance 105.
 *
 * What it shows instead is the official rate card. That is a fact rather than a
 * computation, so it cannot be wrong, and it is the thing a rider actually
 * needs in the moment: enough to check whether the fare being asked of them is
 * plausible.
 */
export default function OfflineFareNotice({ farePolicy, onRetry }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="cloud-offline-outline" size={22} color={colors.textMuted} />
        <Text style={styles.title}>You are offline</Text>
      </View>

      <Text style={styles.body}>
        There is no official distance saved for this trip, so the fare cannot be worked out
        right now. Reconnect to get the exact fare.
      </Text>

      {farePolicy ? (
        <View style={styles.rates}>
          <Text style={styles.ratesTitle}>Official rates</Text>

          <Row
            label={`First ${farePolicy.baseDistanceKm} km`}
            value={peso(farePolicy.baseFare)}
          />
          <Row label="Each extra km" value={peso(farePolicy.perKmRate)} />
          <Row label="Student, senior or PWD" value="20% off" />

          <Text style={styles.footnote}>
            Ordinance 105, s. 2023. Partial kilometres past the first{' '}
            {farePolicy.baseDistanceKm} km are billed as whole kilometres.
          </Text>
        </View>
      ) : (
        <Text style={styles.body}>
          The official rates have not been downloaded to this phone yet. Connect once and they
          will be available offline afterwards.
        </Text>
      )}

      <Button label="Try again" onPress={onRetry} variant="secondary" />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...text.heading,
    color: colors.textStrong,
  },
  body: {
    ...text.body,
    color: colors.textMuted,
  },
  rates: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  ratesTitle: {
    ...text.sectionLabel,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...text.body,
    color: colors.textMuted,
    flexShrink: 1,
  },
  rowValue: {
    ...text.body,
    color: colors.textStrong,
    fontWeight: '600',
  },
  footnote: {
    ...text.meta,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
