import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { ListSkeleton } from '@/ui/Skeleton';

interface StorageFile {
  key: string;
  filename: string;
  size: number;
  uploadedAt: string;
  mimeType: string;
}

interface StorageResponse {
  files: StorageFile[];
  totalCount: number;
  totalSize: number;
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
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<StorageResponse>('/api/admin/storage/files');
      setData(res);
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

  const handleDelete = (file: StorageFile) => {
    Alert.alert(
      'Delete File',
      `Delete "${file.filename}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingKey(file.key);
            try {
              await api.delete(`/api/admin/storage/files/${encodeURIComponent(file.key)}`);
              await load();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Delete failed.');
            } finally {
              setDeletingKey(null);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ListSkeleton count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={data?.files ?? []}
        keyExtractor={(f) => f.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            <View style={s.headerRow}>
              <Pressable onPress={() => router.back()}>
                <Text style={s.backBtn}>Back</Text>
              </Pressable>
              <Text style={s.title}>Storage</Text>
            </View>
            {data && (
              <View style={s.summary}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{data.totalCount}</Text>
                  <Text style={s.summaryLabel}>Files</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{formatBytes(data.totalSize)}</Text>
                  <Text style={s.summaryLabel}>Total Size</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No evidence files found.</Text>}
        renderItem={({ item }) => {
          const isDeleting = deletingKey === item.key;
          const isImage = item.mimeType.startsWith('image/');
          return (
            <View style={s.card}>
              <View style={s.cardRow}>
                <View style={[s.typeBadge, isImage ? s.typeBadgeImage : s.typeBadgeVideo]}>
                  <Text style={s.typeBadgeText}>{isImage ? 'IMG' : 'VID'}</Text>
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.filename} numberOfLines={1}>{item.filename}</Text>
                  <Text style={s.meta}>
                    {formatBytes(item.size)} · {new Date(item.uploadedAt).toLocaleDateString('en-PH')}
                  </Text>
                </View>
                <Pressable
                  style={[s.deleteBtn, isDeleting && s.deleteBtnDisabled]}
                  onPress={() => handleDelete(item)}
                  disabled={isDeleting}
                >
                  {isDeleting
                    ? <ActivityIndicator color="#dc2626" size="small" />
                    : <Text style={s.deleteBtnText}>Delete</Text>}
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  backBtn: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  summary: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  summaryVal: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  summaryLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  typeBadgeImage: { backgroundColor: '#dbeafe' },
  typeBadgeVideo: { backgroundColor: '#fce7f3' },
  typeBadgeText: { fontSize: 10, fontWeight: '800', color: '#374151' },
  cardInfo: { flex: 1 },
  filename: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' },
  deleteBtnDisabled: { opacity: 0.5 },
  deleteBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
});
