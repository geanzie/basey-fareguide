import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, Pressable, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAdminFareRates, createFareRate } from '@/services/fare';
import type { FareRate } from '@/types/fare';
import { ListSkeleton } from '@/ui/Skeleton';

export default function AdminFareRatesScreen() {
  const [rates, setRates] = useState<FareRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ baseFare: '', perKmRate: '', notes: '' });

  const load = useCallback(async () => {
    try {
      const res = await fetchAdminFareRates();
      setRates(res.items);
    } catch {} finally {
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
      Alert.alert('Invalid', 'Enter valid numbers for base fare and per-km rate.');
      return;
    }

    if (!form.notes.trim()) {
      Alert.alert('Required', 'Admin note is required for fare changes.');
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
      Alert.alert('Error', err instanceof Error ? err.message : 'Creation failed.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ListSkeleton count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={rates}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            <View style={s.titleRow}>
              <Text style={s.title}>Fare Rates</Text>
              <Pressable style={s.addBtn} onPress={() => setShowForm((v) => !v)}>
                <Text style={s.addBtnText}>{showForm ? 'Cancel' : '+ New Rate'}</Text>
              </Pressable>
            </View>
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
