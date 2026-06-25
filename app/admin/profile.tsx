import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GradientHeader from '@/ui/GradientHeader';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { logoutRequest } from '@/services/auth';
import { useFeedback } from '@/ui/FeedbackProvider';

export default function AdminProfileScreen() {
  const { user, token, clearSession } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const { showConfirm } = useFeedback();

  const handleLogout = () => {
    showConfirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign Out',
      destructive: true,
      onConfirm: async () => {
        setLoggingOut(true);
        try {
          if (token) await logoutRequest(token);
        } catch {}
        await clearSession();
        router.replace('/login');
      },
    });
  };

  if (!user) return null;

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`;

  const management: { label: string; icon: keyof typeof Ionicons.glyphMap; route: string }[] = [
    { label: 'Reports', icon: 'bar-chart-outline', route: '/admin/reports' },
    { label: 'Discount Cards', icon: 'card-outline', route: '/admin/discount-cards' },
    { label: 'Ticket Payments', icon: 'receipt-outline', route: '/admin/ticket-payments' },
    { label: 'Storage', icon: 'cloud-outline', route: '/admin/storage' },
    { label: 'Settings', icon: 'settings-outline', route: '/admin/settings' },
  ];

  return (
    <View style={s.container}>
      <GradientHeader title="Profile">
        <View style={s.avatarBox}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{user.firstName} {user.lastName}</Text>
          <Text style={s.username}>@{user.username}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>Administrator</Text>
          </View>
        </View>
      </GradientHeader>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.infoCard}>
          {[
            { label: 'Account Status', value: user.isActive ? 'Active' : 'Inactive' },
            { label: 'Verified', value: user.isVerified ? 'Yes' : 'No' },
            { label: 'Role', value: 'Admin' },
          ].map((row) => (
            <View key={row.label} style={s.infoRow}>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Management</Text>
        <View style={s.infoCard}>
          {management.map((item) => (
            <Pressable
              key={item.route}
              style={s.menuRow}
              onPress={() => router.push(item.route as never)}
            >
              <Ionicons name={item.icon} size={20} color="#16a34a" style={s.menuIcon} />
              <Text style={s.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[s.logoutBtn, loggingOut && s.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut
            ? <ActivityIndicator color="#dc2626" />
            : <Text style={s.logoutText}>Sign Out</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 24 },
  avatarBox: { alignItems: 'center', marginTop: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', color: '#fff' },
  username: { color: '#bbf7d0', fontSize: 14, marginTop: 2 },
  roleBadge: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 4, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, marginLeft: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIcon: { marginRight: 12 },
  menuLabel: { flex: 1, color: '#0f172a', fontSize: 14, fontWeight: '600' },
  infoLabel: { color: '#64748b', fontSize: 14 },
  infoValue: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  logoutBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#dc2626' },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
