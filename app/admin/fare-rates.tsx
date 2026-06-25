import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, Pressable, TextInput,
} from 'react-native';
import GradientHeader from '@/ui/GradientHeader';
import { fetchAdminFareRates, createFareRate } from '@/services/fare';
import type { FareRate } from '@/types/fare';
import { ListSkeleton } from '@/ui/Skeleton';
import { useFeedback } from '@/ui/FeedbackProvider';

export default function AdminFareRatesScreen() {
  const { showError, showWarning } = useFeedback();
  const [rates, setRates] = useState<FareRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ baseFare: '', perKmRate: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const res = await fetchAdminFareRates();
      setRates(res.items);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fare rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    const baseFare = parseFloat(form.baseFare);
    const perKmRate = parseFloat(form.perKmRate);

    if (!Number.isFinite(baseFare) || !Number.isFinite(perKmRate)) {
      showWarning('Enter valid numbers for base fare and per-km rate.', { title: 'Invalid' });
      return;
    }

    if (!form.notes.trim()) {
      showWarning('Admin note is required for fare changes.', { title: 'Required' });
      return;
    }

    setCreating(true);
    try {
      await createFareRate({
        baseFare,
        perKmRate,
        notes: form.notes.trim(),
      });
      setShowForm(false);
      setForm({ baseFare: '', perKmRate: '', notes: '' });
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Creation failed.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Fare Rates" />
        <ListSkeleton count={3} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GradientHeader
        title="Fare Rates"
        right={
          <Pressable style={s.headerAddBtn} onPress={() => setShowForm((v) => !v)}>
            <Text style={s.headerAddBtnText}>{showForm ? 'Cancel' : '+ New Rate'}</Text>
          </Pressable>
        }
      />
      <FlatList
        data={rates}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
                <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
                  <Text style={s.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {showForm && (
              <View style={s.formCard}>
                {[
                  { key: 'baseFare', label: 'Base Fare (₱)', kb: 'numeric' },
                  { key: 'perKmRate', label: 'Per Km Rate (₱)', kb: 'numeric' },
                  { key: 'notes', label: 'Admin Note (required)', kb: 'default' },
                ].map((f) => (
                  <View key={f.key} style={s.formField}>
                    <Text style={s.formLabel}>{f.label}</Text>
                    <TextInput
                      style={s.formInput}
                      value={form[f.key as keyof typeof form]}
                      onChangeText={(t) => setForm((prev) => ({ ...prev, [f.key]: t }))}
                      keyboardType={f.kb as never}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                ))}
                <Pressable
                  style={[s.createBtn, creating && s.createBtnDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.createBtnText}>Create Rate</Text>}
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No fare rates configured.</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, item.isActive && s.cardActive]}>
            {item.isActive && (
              <View style={s.activeBadge}>
                <Text style={s.activeBadgeText}>ACTIVE</Text>
              </View>
            )}
            <Text style={s.rateMain}>₱{item.baseFare} base · ₱{item.perKmRate}/km</Text>
            <Text style={s.rateSub}>Base distance: {item.baseDistanceKm} km</Text>
            {item.notes ? <Text style={s.rateNotes}>{item.notes}</Text> : null}
            <Text style={s.rateMeta}>
              Effective {new Date(item.effectiveAt).toLocaleDateString('en-PH')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', flex: 1, marginRight: 12 },
  retryBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerAddBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  headerAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  formField: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  createBtn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  cardActive: { borderLeftWidth: 4, borderLeftColor: '#16a34a' },
  activeBadge: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8 },
  activeBadgeText: { color: '#16a34a', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rateMain: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  rateSub: { color: '#64748b', fontSize: 13, marginTop: 2 },
  rateNotes: { color: '#94a3b8', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  rateMeta: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
});
