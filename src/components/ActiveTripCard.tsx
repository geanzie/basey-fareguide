import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import Card from '@/ui/Card';
import { colors, radii, spacing, statusColor } from '@/ui/theme';
import { fetchActiveTripStatus, type RiderTrip } from '@/services/rides';

const POLL_MS = 10000;

function minutesLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60000);
}

/**
 * Self-polling card showing the public rider's current trip request. Renders
 * null when there is no active trip, so it's safe to always mount. Reads server
 * state, so it survives refresh / re-login (unlike the old local-only badge).
 */
export default function ActiveTripCard() {
  const [trip, setTrip] = useState<RiderTrip | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchActiveTripStatus();
      setTrip(res.hasActiveTrip ? res.trip : null);
    } catch {
      // keep last known state; next poll retries
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  if (!trip) return null;

  const tone = statusColor(trip.status);
  const isPending = trip.status === 'PENDING';
  const mins = minutesLeft(trip.expiresAt);

  return (
    <Card style={s.card}>
      <View style={s.top}>
        <View style={[s.pill, { backgroundColor: tone + '1a' }]}>
          <Ionicons name={isPending ? 'time' : 'checkmark-circle'} size={14} color={tone} />
          <Text style={[s.pillText, { color: tone }]}>{trip.statusLabel}</Text>
        </View>
        <Text style={s.fare}>₱{trip.fare.toFixed(2)}</Text>
      </View>

      <View style={s.routeLine}>
        <Ionicons name="ellipse" size={9} color={colors.warning} />
        <Text style={s.routeText} numberOfLines={1}>{trip.origin}</Text>
      </View>
      <View style={s.connector} />
      <View style={s.routeLine}>
        <Ionicons name="location" size={11} color={colors.primary} />
        <Text style={s.routeText} numberOfLines={1}>{trip.destination}</Text>
      </View>

      <Text style={s.meta}>
        {isPending
          ? mins != null
            ? `Waiting for driver · expires in ~${mins} min`
            : 'Waiting for driver to accept'
          : `${trip.vehicleType.replace(/_/g, ' ')} · ${trip.vehiclePlateNumber}`}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: spacing.md, marginBottom: spacing.md, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
  pillText: { fontSize: 12, fontWeight: '700' },
  fare: { fontSize: 16, fontWeight: '800', color: colors.primary },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routeText: { flex: 1, fontWeight: '600', color: colors.textStrong, fontSize: 14 },
  connector: { width: 1, height: 10, backgroundColor: colors.border, marginLeft: 5 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
