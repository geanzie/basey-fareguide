import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, Alert, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';

interface AdminUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  userType: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

const USER_TYPES = ['ADMIN', 'DATA_ENCODER', 'ENFORCER'] as const;
type CreateUserType = typeof USER_TYPES[number];

const EMPTY_FORM = { firstName: '', lastName: '', username: '', phoneNumber: '', userType: 'ENFORCER' as CreateUserType };

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const load = async () => {
    try {
      const data = await api.get<{ items: AdminUser[] }>('/api/admin/users');
      setUsers(data.items);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setAddError('');
    setShowAdd(true);
  };

  const closeAdd = () => {
    setShowAdd(false);
    setAddError('');
  };

  const submitAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.phoneNumber.trim()) {
      setAddError('All fields are required.');
      return;
    }
    setAddLoading(true);
    setAddError('');
    try {
      const res = await api.post<{ data: { user: AdminUser; tempPassword: string }; message: string }>(
        '/api/admin/users/create',
        { ...form, firstName: form.firstName.trim(), lastName: form.lastName.trim(), username: form.username.trim(), phoneNumber: form.phoneNumber.trim() },
      );
      closeAdd();
      await load();
      Alert.alert(
        'Account Created',
        `Temporary password for @${res.data.user.username}:\n\n${res.data.tempPassword}\n\nShare this with the user and ask them to change it on first login.`,
        [{ text: 'OK' }],
      );
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setAddLoading(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={s.center}><ActivityIndicator color="#16a34a" size="large" /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerRow}>
            <Text style={s.title}>User Management</Text>
            <TouchableOpacity style={s.addBtn} onPress={openAdd}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>No users found.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{item.firstName[0]}{item.lastName[0]}</Text>
              </View>
              <View style={s.info}>
                <Text style={s.name}>{item.firstName} {item.lastName}</Text>
                <Text style={s.username}>@{item.username}</Text>
              </View>
              <View style={[s.badge, !item.isActive && s.badgeInactive]}>
                <Text style={[s.badgeText, !item.isActive && s.badgeTextInactive]}>
                  {item.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <Text style={s.role}>{item.userType.replace('_', ' ')}</Text>
            <Text style={s.meta}>
              Joined {new Date(item.createdAt).toLocaleDateString('en-PH')} · {item.isVerified ? 'Verified' : 'Unverified'}
            </Text>
          </View>
        )}
      />

      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeAdd}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add Account</Text>
            <Pressable onPress={closeAdd}><Text style={s.cancel}>Cancel</Text></Pressable>
          </View>
          <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={s.fieldLabel}>First Name</Text>
            <TextInput
              style={s.input}
              value={form.firstName}
              onChangeText={(v) => setForm((f) => ({ ...f, firstName: v }))}
              placeholder="First name"
              placeholderTextColor="#94a3b8"
            />
            <Text style={s.fieldLabel}>Last Name</Text>
            <TextInput
              style={s.input}
              value={form.lastName}
              onChangeText={(v) => setForm((f) => ({ ...f, lastName: v }))}
              placeholder="Last name"
              placeholderTextColor="#94a3b8"
            />
            <Text style={s.fieldLabel}>Username</Text>
            <TextInput
              style={s.input}
              value={form.username}
              onChangeText={(v) => setForm((f) => ({ ...f, username: v.toLowerCase().replace(/\s/g, '') }))}
              placeholder="username"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
            <Text style={s.fieldLabel}>Phone Number</Text>
            <TextInput
              style={s.input}
              value={form.phoneNumber}
              onChangeText={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
              placeholder="+63 9xx xxx xxxx"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
            <Text style={s.fieldLabel}>Role</Text>
            <View style={s.typeRow}>
              {USER_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[s.typeChip, form.userType === t && s.typeChipActive]}
                  onPress={() => setForm((f) => ({ ...f, userType: t }))}
                >
                  <Text style={[s.typeChipText, form.userType === t && s.typeChipTextActive]}>
                    {t.replace('_', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
            {addError ? <Text style={s.error}>{addError}</Text> : null}
            <Pressable
              style={[s.submitBtn, addLoading && s.submitDisabled]}
              onPress={submitAdd}
              disabled={addLoading}
            >
              {addLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>Create Account</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarText: { fontWeight: '700', color: '#64748b' },
  info: { flex: 1 },
  name: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  username: { color: '#64748b', fontSize: 12 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
  badgeTextInactive: { color: '#94a3b8' },
  role: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 11, color: '#94a3b8' },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cancel: { color: '#3b82f6', fontSize: 15 },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff' },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  typeChipActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  typeChipTextActive: { color: '#16a34a' },
  error: { color: '#dc2626', fontSize: 13, marginTop: 12 },
  submitBtn: { marginTop: 24, backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 40 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
