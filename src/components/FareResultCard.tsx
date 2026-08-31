import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, text } from '@/ui/theme';
import type { RouteCalculationResponse, RouteSource } from '@/types/fare';
import { OFFLINE_CACHE_REASON, OFFLINE_CURATED_REASON } from '@/lib/offline/offlineQuote';

interface Props {
  result: RouteCalculationResponse;
  /** Whether the breakdown ledger is open. */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** How the fare was categorised, e.g. "Student fare" or "Regular fare". */
  passengerLabel: string;
  /** True when an approved discount card produced the discount. */
  discountCardApplied: boolean;
  /** Offered only when the passenger has no usable card. */
  onApplyForCard?: () => void;
}

const peso = (n: number) => `₱${n.toFixed(2)}`;

/**
 * Says where an offline fare came from.
 *
 * Both sources are exact — the surveyed corpus, or a replay of a route this
 * phone already measured — so this reads as provenance rather than a warning.
 * It is not an estimate notice: the app never shows an estimated fare.
 */
function offlineLabel(fallbackReason: string | null): string | null {
  if (fallbackReason === OFFLINE_CURATED_REASON) {
    return 'Offline — official surveyed distance for this route.';
  }
  if (fallbackReason === OFFLINE_CACHE_REASON) {
    return 'Offline — the verified route you already measured for this pair.';
  }
  return null;
}

function providerLabel(method: RouteSource | null): string | null {
  if (method === 'ors') return 'Route measured via OpenRouteService';
  if (method === 'google_routes') return 'Route measured via Google Routes';
  if (method === 'valhalla') return 'Route measured on the Basey road network';
  // A surveyed distance is the most trustworthy number here, so it says so
  // rather than naming an engine that was never consulted.
  if (method === 'curated') return 'Surveyed distance for this route';
  return null;
}

function effectiveLabel(effectiveAt?: string | null): string {
  if (!effectiveAt) return 'Ordinance 105, s. 2023';
  const date = new Date(effectiveAt);
  if (Number.isNaN(date.getTime())) return 'Ordinance 105, s. 2023';
  const formatted = date.toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `Ordinance 105, s. 2023 · rate effective ${formatted}`;
}

/**
 * The fare, set as a tariff record rather than a price quote: ink on paper,
 * ruled above and below, cited to the ordinance it comes from. The breakdown
 * below it is a ledger whose rows visibly sum to the total — including the
 * whole-kilometre ceiling, which the old formula line hid.
 */
export default function FareResultCard({
  result,
  expanded,
  onToggleExpanded,
  passengerLabel,
  discountCardApplied,
  onApplyForCard,
}: Props) {
  const { fareBreakdown: breakdown, farePolicy: policy } = result;

  const discount = breakdown.discount ?? 0;
  const isDiscounted = discount > 0;
  const subtotal = breakdown.baseFare + breakdown.additionalFare;
  const billedKm = Math.ceil(breakdown.additionalKm);
  const discountPercent = subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0;
  const provider = providerLabel(result.method);
  const offlineSource = offlineLabel(result.fallbackReason);

  return (
    <View>
      <View style={s.headingRow}>
        <Text style={text.sectionLabel}>Fare</Text>
        <View style={s.headingRule} />
      </View>

      <View style={s.figureRow}>
        <Text style={s.figure} accessibilityLabel={`Fare ${result.fare.toFixed(2)} pesos`}>
          {peso(result.fare)}
        </Text>
        {isDiscounted ? (
          <View style={s.wasWrap}>
            <Text style={s.wasLabel}>Regular</Text>
            <Text style={s.wasValue}>{peso(subtotal)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={s.trip}>
        {result.distanceKm.toFixed(2)} km
        {result.durationMin != null ? ` · about ${Math.round(result.durationMin)} min` : ''}
      </Text>

      <View style={s.rule} />

      <View style={s.passengerRow}>
        {isDiscounted && discountCardApplied ? (
          <View style={s.cardPill}>
            <Ionicons name="ribbon-outline" size={13} color={colors.primaryDark} />
            <Text style={s.cardPillText}>{passengerLabel} · card applied</Text>
          </View>
        ) : (
          <Text style={s.passengerText}>{passengerLabel}</Text>
        )}

        {!isDiscounted && onApplyForCard ? (
          <Pressable onPress={onApplyForCard} hitSlop={8} accessibilityRole="link">
            <Text style={s.cardLink}>Get a discount card</Text>
          </Pressable>
        ) : null}
      </View>

      {offlineSource ? (
        <View style={s.offlineNote}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
          <Text style={s.offlineText}>{offlineSource}</Text>
        </View>
      ) : result.isEstimate ? (
        <View style={s.estimateNote}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.warningDark} />
          <Text style={s.estimateText}>
            Straight-line estimate — no road route was available for this pair.
          </Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [s.disclosure, pressed && s.disclosurePressed]}
        onPress={onToggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text style={s.disclosureText}>How was this calculated?</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </Pressable>

      {expanded ? (
        <View style={s.ledger}>
          <LedgerRow
            label={`Base fare (first ${policy.baseDistanceKm} km)`}
            amount={peso(breakdown.baseFare)}
          />

          {breakdown.additionalKm > 0 ? (
            <>
              <LedgerRow
                label={`${billedKm} km × ${peso(policy.perKmRate)}/km`}
                amount={peso(breakdown.additionalFare)}
              />
              <Text style={s.ledgerNote}>
                {breakdown.additionalKm.toFixed(2)} km beyond the base, billed as {billedKm} km —
                the ordinance charges whole kilometres.
              </Text>
            </>
          ) : (
            <Text style={s.ledgerNote}>
              The trip is within the base distance, so no per-kilometre charge applies.
            </Text>
          )}

          <View style={s.ledgerRule} />
          <LedgerRow label="Subtotal" amount={peso(subtotal)} />

          {isDiscounted ? (
            <LedgerRow
              label={`${passengerLabel} discount (${discountPercent}%)`}
              amount={`−${peso(discount)}`}
              tone={colors.primaryDark}
            />
          ) : null}

          <View style={s.ledgerRuleStrong} />
          <LedgerRow label="Total fare" amount={peso(result.fare)} strong />

          <Text style={s.citation}>{effectiveLabel(policy.effectiveAt)}</Text>
          {provider ? <Text style={s.citation}>{provider}</Text> : null}
          {result.twoWheelerNotice ? (
            // Google requires this notice wherever a two-wheeled route is shown.
            <Text style={s.betaNotice}>
              Two-wheeled routes are in beta and may be missing sidewalks, pedestrian paths,
              or other restrictions.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LedgerRow({
  label,
  amount,
  strong,
  tone,
}: {
  label: string;
  amount: string;
  strong?: boolean;
  tone?: string;
}) {
  return (
    <View style={s.ledgerRow}>
      <Text style={[s.ledgerLabel, strong && s.ledgerLabelStrong]} numberOfLines={2}>
        {label}
      </Text>
      <Text
        style={[
          s.ledgerAmount,
          strong && s.ledgerAmountStrong,
          tone ? { color: tone } : null,
        ]}
      >
        {amount}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headingRule: { flex: 1, height: 1, backgroundColor: colors.border },

  figureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: 6,
  },
  figure: { ...text.fareFigure },
  wasWrap: { alignItems: 'flex-end', paddingBottom: 6 },
  wasLabel: { ...text.sectionLabel, fontSize: 10 },
  wasValue: {
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  trip: { fontSize: 14, color: colors.textBody, marginTop: 2 },

  rule: { height: 1, backgroundColor: colors.rule, marginTop: spacing.md },

  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 34,
  },
  passengerText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  cardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceTint,
  },
  cardPillText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  cardLink: { fontSize: 13, fontWeight: '600', color: colors.info },

  estimateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  estimateText: { flex: 1, fontSize: 12, color: colors.warningDark },

  // Provenance, not a warning: an offline fare here is an exact figure, so it
  // is styled in muted text rather than the amber an estimate would get.
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  offlineText: { flex: 1, fontSize: 12, color: colors.textMuted },

  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radii.sm,
  },
  disclosurePressed: { backgroundColor: colors.surfaceAlt },
  disclosureText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textBody },

  ledger: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 2,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 24,
  },
  ledgerLabel: { flex: 1, fontSize: 13, color: colors.textBody },
  ledgerLabelStrong: { fontWeight: '700', color: colors.textStrong },
  ledgerAmount: { ...text.ledger },
  ledgerAmountStrong: { fontWeight: '700', fontSize: 15 },
  ledgerNote: { fontSize: 11, color: colors.textMuted, lineHeight: 15, marginBottom: 4 },
  ledgerRule: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  ledgerRuleStrong: { height: 2, backgroundColor: colors.rule, marginVertical: 6 },
  citation: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  betaNotice: { fontSize: 11, color: colors.warningDark, marginTop: 6 },
});
