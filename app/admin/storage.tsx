import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import GradientHeader from '@/ui/GradientHeader';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ListSkeleton } from '@/ui/Skeleton';

// GET /api/admin/storage returns aggregate stats only (no per-file listing).
interface StorageResponse {
  storage: {
    byType: { fileType: string | null; _sum: { fileSize: number | null }; _count: { id: number } }[];
    total: { files: number; sizeBytes: number; sizeMB: number };
  };
  recommendations: { cleanupNeeded: boolean; oldIncidentsCount: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminStorageScreen() {
  const router = useRouter();
  const [data, setData] = useState<StorageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<StorageResponse>('/api/admin/storage');
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage stats.');
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

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Storage" onBack={() => router.back()} />
        <ListSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <GradientHeader title="Storage" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setLoading(true); void load(); }}>
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {data && (
          <>
            <View style={s.summary}>
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{data.storage.total.files}</Text>
                <Text style={s.summaryLabel}>Files</Text>
              </View>
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{formatBytes(data.storage.total.sizeBytes)}</Text>
                <Text style={s.summaryLabel}>Total Size</Text>
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>By File Type</Text>
              {data.storage.byType.length === 0 ? (
                <Text style={s.empty}>No evidence files.</Text>
              ) : (
                data.storage.byType.map((t) => (
                  <View key={t.fileType ?? 'UNKNOWN'} style={s.row}>
                    <Text style={s.rowLabel}>{t.fileType ?? 'UNKNOWN'}</Text>
                    <Text style={s.rowVal}>
                      {t._count.id} · {formatBytes(t._sum.fileSize ?? 0)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {data.recommendations.cleanupNeeded && (
              <View style={s.notice}>
                <Text style={s.noticeText}>
                  Cleanup recommended — {data.recommendations.oldIncidentsCount} resolved
                  incident(s) older than 30 days have evidence eligible for removal.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16 },
  errorBox: { marginBottom: 12, backgroundColor: '#fef2f2', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  errorText: { color: '#dc2626', fontSize: 13, fontWeight: '500', flex: 1, marginRight: 12 },
  retryBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summary: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  summaryVal: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  summaryLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowLabel: { fontSize: 13, color: '#374151' },
  rowVal: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  empty: { color: '#94a3b8', fontSize: 13 },
  notice: { backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fde68a' },
  noticeText: { color: '#92400e', fontSize: 12, lineHeight: 18 },
});
