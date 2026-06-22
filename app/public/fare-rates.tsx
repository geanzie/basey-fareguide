import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { ListSkeleton } from '@/ui/Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchCurrentFareRates, type FareRatesResponse } from '@/services/fare';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface RateCardProps {
  label: string;
  baseFare: number;
  baseDistanceKm: number;
  perKmRate: number;
  effectiveAt: string | null;
  isUpcoming?: boolean;
}

function RateCard({ label, baseFare, baseDistanceKm, perKmRate, effectiveAt, isUpcoming }: RateCardProps) {
  return (
    <View style={[s.card, isUpcoming && s.cardUpcoming]}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>{label}</Text>
        {isUpcoming && (
          <View style={s.upcomingBadge}>
            <Text style={s.upcomingBadgeText}>UPCOMING</Text>
          </View>
        )}
      </View>

      <View style={s.rateGrid}>
        <View style={s.rateItem}>
          <Text style={s.rateLabel}>Base Fare</Text>
          <Text style={s.rateValue}>₱{baseFare.toFixed(2)}</Text>
        </View>
        <View style={s.rateItem}>
          <Text style={s.rateLabel}>Base Distance</Text>
          <Text style={s.rateValue}>{baseDistanceKm} km</Text>
        </View>
        <View style={s.rateItem}>
          <Text style={s.rateLabel}>Per km Rate</Text>
          <Text style={s.rateValue}>₱{perKmRate.toFixed(2)}/km</Text>
        </View>
        <View style={s.rateItem}>
          <Text style={s.rateLabel}>{isUpcoming ? 'Takes Effect' : 'Effective Since'}</Text>
          <Text style={s.rateValue}>{formatDate(effectiveAt)}</Text>
        </View>
      </View>

      <Text style={s.formula}>
        Fare = ₱{baseFare.toFixed(2)} + max(distance − {baseDistanceKm} km, 0) × ₱{perKmRate.toFixed(2)}/km
      </Text>
      <Text style={s.formulaNote}>20% discount for Senior Citizens, PWD, and Students</Text>
    </View>
  );
}

export default function FareRatesScreen() {
  const [rates, setRates] = useState<FareRatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentFareRates()
      .then(setRates)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load rates.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Fare Rates</Text>
        <Text style={s.subtitle}>Municipal Ordinance 105, Series of 2023</Text>

        {loading && <ListSkeleton count={2} />}

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {rates && (
          <>
            <RateCard
              label="Current Rates"
              baseFare={rates.current.baseFare}
              baseDistanceKm={rates.current.baseDistanceKm}
              perKmRate={rates.current.perKmRate}
              effectiveAt={rates.current.effectiveAt}
            />

            {rates.upcoming && (
              <RateCard
                label="Upcoming Rates"
                baseFare={rates.upcoming.baseFare}
                baseDistanceKm={rates.upcoming.baseDistanceKm}
                perKmRate={rates.upcoming.perKmRate}
                effectiveAt={rates.upcoming.effectiveAt}
                isUpcoming
              />
            )}
          </>
        )}

        <View style={s.notice}>
          <Text style={s.noticeText}>
            Rates are set by the Municipality of Basey under Municipal Ordinance 105 Series of 2023.
            All fares shown are per trip, per vehicle.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  spinner: { marginTop: 40 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    elevation: 3,
  },
  cardUpcoming: { borderWidth: 2, borderColor: '#fbbf24' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  upcomingBadge: { backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  upcomingBadgeText: { fontSize: 10, fontWeight: '700', color: '#d97706', letterSpacing: 0.8 },
  rateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  rateItem: { width: '47%', backgroundColor: '#f8fafc', borderRadius: 10, padding: 12 },
  rateLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  rateValue: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  formula: { fontSize: 12, color: '#374151', backgroundColor: '#f1f5f9', borderRadius: 8, padding: 10, fontFamily: 'monospace', marginBottom: 6 },
  formulaNote: { fontSize: 11, color: '#64748b' },
  notice: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16, marginTop: 8 },
  noticeText: { fontSize: 12, color: '#166534', lineHeight: 18 },
});
