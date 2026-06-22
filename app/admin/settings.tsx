import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Pressable, Alert, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';

type Provider = 'ors' | 'google_routes';

interface RoutingSettings {
  primaryProvider: Provider;
  fallbackProvider: Provider;
  fallbackEnabled: boolean;
  source: 'database' | 'environment_default';
  lastUpdatedByName: string | null;
  lastUpdatedAt: string | null;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  ors: 'ORS (OpenRouteService)',
  google_routes: 'Google Routes',
};

export default function AdminSettingsScreen() {
  const [settings, setSettings] = useState<RoutingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<RoutingSettings>('/api/admin/settings/routing');
      setSettings(res);
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

  const handleSwitch = (provider: Provider) => {
    if (!settings || settings.primaryProvider === provider) return;
    Alert.alert(
      'Switch Routing Provider',
      `Set primary provider to ${PROVIDER_LABELS[provider]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setSaving(true);
            try {
              const res = await api.patch<{ settings: RoutingSettings }>('/api/admin/settings/routing', { primaryProvider: provider });
              setSettings(res.settings);
              Alert.alert('Saved', `Primary provider set to ${PROVIDER_LABELS[provider]}.`);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Update failed.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  if (!settings) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.errorText}>Failed to load routing settings.</Text>
        <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
          <Text style={s.retryBtnText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.title}>Routing Settings</Text>
        <Text style={s.subtitle}>Select primary route calculation provider</Text>

        <View style={s.section}>
          <Text style={s.sectionLabel}>PRIMARY PROVIDER</Text>
          {(['ors', 'google_routes'] as Provider[]).map((provider) => {
            const active = settings.primaryProvider === provider;
            return (
              <Pressable
                key={provider}
                style={[s.providerCard, active && s.providerCardActive]}
                onPress={() => handleSwitch(provider)}
                disabled={saving || active}
              >
                <View style={s.providerRow}>
                  <View style={[s.radioOuter, active && s.radioOuterActive]}>
                    {active && <View style={s.radioInner} />}
                  </View>
                  <Text style={[s.providerLabel, active && s.providerLabelActive]}>
                    {PROVIDER_LABELS[provider]}
                  </Text>
                  {saving && active && <ActivityIndicator color="#16a34a" size="small" style={s.savingSpinner} />}
                </View>
                {active && (
                  <View style={s.activeBadge}>
                    <Text style={s.activeBadgeText}>ACTIVE</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Fallback Provider</Text>
            <Text style={s.infoValue}>{PROVIDER_LABELS[settings.fallbackProvider]}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Fallback Enabled</Text>
            <Text style={[s.infoValue, { color: settings.fallbackEnabled ? '#16a34a' : '#dc2626' }]}>
              {settings.fallbackEnabled ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Config Source</Text>
            <Text style={s.infoValue}>{settings.source === 'database' ? 'Database' : 'Env Default'}</Text>
          </View>
          {settings.lastUpdatedByName && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Last Changed By</Text>
              <Text style={s.infoValue}>{settings.lastUpdatedByName}</Text>
            </View>
          )}
          {settings.lastUpdatedAt && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Last Changed</Text>
              <Text style={s.infoValue}>{new Date(settings.lastUpdatedAt).toLocaleDateString('en-PH')}</Text>
            </View>
          )}
        </View>

        <Text style={s.note}>
          GPS/Haversine fallback always active as final fallback. Road providers used first for accuracy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginBottom: 10 },
  providerCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: '#e2e8f0' },
  providerCardActive: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#16a34a' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
  providerLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#64748b' },
  providerLabelActive: { color: '#0f172a' },
  activeBadge: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 10 },
  activeBadgeText: { color: '#16a34a', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  savingSpinner: { marginLeft: 4 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 4, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { color: '#64748b', fontSize: 14 },
  infoValue: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  note: { fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
  errorText: { color: '#dc2626', fontSize: 15, marginBottom: 16 },
  retryBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
});
