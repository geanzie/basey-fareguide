import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  ActivityIndicator, Pressable, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchActiveAnnouncements, createAnnouncement, archiveAnnouncement } from '@/services/announcements';
import type { Announcement, AnnouncementCategory } from '@/types/common';

const CATEGORIES: AnnouncementCategory[] = [
  'EMERGENCY_NOTICE', 'ROAD_CLOSURE', 'ROAD_WORK', 'TRAFFIC_ADVISORY', 'GENERAL_INFORMATION',
];

const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  EMERGENCY_NOTICE: '#dc2626',
  ROAD_CLOSURE: '#f59e0b',
  ROAD_WORK: '#f59e0b',
  TRAFFIC_ADVISORY: '#3b82f6',
  GENERAL_INFORMATION: '#16a34a',
};

export default function AdminAnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '' as AnnouncementCategory | '' });

  const load = useCallback(async () => {
    try {
      const res = await fetchActiveAnnouncements();
      setAnnouncements(res.items);
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
    if (!form.title.trim()) { Alert.alert('Required', 'Enter a title.'); return; }
    if (!form.content.trim()) { Alert.alert('Required', 'Enter content.'); return; }
    if (!form.category) { Alert.alert('Required', 'Select a category.'); return; }

    setCreating(true);
    try {
      await createAnnouncement({
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
      });
      setShowForm(false);
      setForm({ title: '', content: '', category: '' });
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = (id: string, title: string) => {
    Alert.alert('Archive Announcement', `Archive "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archiveAnnouncement(id);
            await load();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View>
            <View style={s.titleRow}>
              <Text style={s.title}>Announcements</Text>
              <Pressable style={s.addBtn} onPress={() => setShowForm((v) => !v)}>
                <Text style={s.addBtnText}>{showForm ? 'Cancel' : '+ New'}</Text>
              </Pressable>
            </View>
            {showForm && (
              <View style={s.formCard}>
                <Text style={s.formLabel}>Title</Text>
                <TextInput
                  style={s.formInput}
                  value={form.title}
                  onChangeText={(t) => setForm((p) => ({ ...p, title: t }))}
                  placeholder="Announcement title"
                  placeholderTextColor="#94a3b8"
                />
                <Text style={s.formLabel}>Content</Text>
                <TextInput
                  style={[s.formInput, s.textArea]}
                  value={form.content}
                  onChangeText={(t) => setForm((p) => ({ ...p, content: t }))}
                  placeholder="Announcement body..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <Text style={s.formLabel}>Category</Text>
                <View style={s.catRow}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[s.catChip, form.category === cat && { backgroundColor: CATEGORY_COLORS[cat] }]}
                      onPress={() => setForm((p) => ({ ...p, category: cat }))}
                    >
                      <Text style={[s.catChipText, form.category === cat && s.catChipTextActive]}>
                        {cat.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  style={[s.createBtn, creating && s.createBtnDisabled]}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.createBtnText}>Post Announcement</Text>}
                </Pressable>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No active announcements.</Text>}
        renderItem={({ item }) => {
          const color = CATEGORY_COLORS[item.category] ?? '#64748b';
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.catDot, { backgroundColor: color }]} />
                <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Pressable style={s.archiveBtn} onPress={() => handleArchive(item.id, item.title)}>
                  <Text style={s.archiveBtnText}>Archive</Text>
                </Pressable>
              </View>
              <Text style={s.cardContent} numberOfLines={3}>{item.content}</Text>
              <Text style={s.cardMeta}>{item.category.replace(/_/g, ' ')}</Text>
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
  list: { padding: 16, gap: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { backgroundColor: '#16a34a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6, marginTop: 8 },
  formInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  textArea: { height: 90, paddingTop: 12 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  catChip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#e2e8f0' },
  catChipText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  catChipTextActive: { color: '#fff' },
  createBtn: { backgroundColor: '#16a34a', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { flex: 1, fontWeight: '700', color: '#0f172a', fontSize: 14 },
  archiveBtn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fef3c7', borderRadius: 8 },
  archiveBtnText: { color: '#b45309', fontSize: 12, fontWeight: '700' },
  cardContent: { color: '#64748b', fontSize: 13 },
  cardMeta: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
});
