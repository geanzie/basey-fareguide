import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { logoutRequest } from '@/services/auth';
import { api } from '@/services/api';

interface PermitInfo {
  permitPlateNumber: string;
  driverFullName: string;
  permitStatus: string;
  permitExpiryDate: string;
  qrToken: string;
}

export default function DriverProfileScreen() {
  const { user, token, clearSession } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [permit, setPermit] = useState<PermitInfo | null>(null);
  const router = useRouter();

  useEffect(() => {
    api.get<PermitInfo>('/api/driver/permit/qr').then(setPermit).catch(() => {});
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            if (token) await logoutRequest(token);
          } catch {}
          await clearSession();
          router.replace('/login');
        },
      },
    ]);
  };

  if (!user) return null;

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.avatarBox}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.name}>{user.firstName} {user.lastName}</Text>
          <Text style={s.username}>@{user.username}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>Driver</Text>
          </View>
        </View>

        <View style={s.infoCard}>
          {[
            { label: 'Account Status', value: user.isActive ? 'Active' : 'Inactive' },
            { label: 'Verified', value: user.isVerified ? 'Yes' : 'No' },
            { label: 'Role', value: 'Driver' },
          ].map((row) => (
            <View key={row.label} style={s.infoRow}>
              <Text style={s.infoLabel}>{row.label}</Text>
              <Text style={s.infoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {permit && (
          <View style={s.permitCard}>
            <Text style={s.permitTitle}>Permit</Text>
            <View style={s.permitRow}>
              <Text style={s.permitLabel}>Plate</Text>
              <Text style={s.permitPlate}>{permit.permitPlateNumber}</Text>
            </View>
            <View style={s.permitRow}>
              <Text style={s.permitLabel}>Status</Text>
              <Text style={[s.permitStatus, { color: permit.permitStatus === 'ACTIVE' ? '#16a34a' : '#dc2626' }]}>
                {permit.permitStatus}
              </Text>
            </View>
            <View style={s.permitRow}>
              <Text style={s.permitLabel}>Expires</Text>
              <Text style={s.permitValue}>{new Date(permit.permitExpiryDate).toLocaleDateString('en-PH')}</Text>
            </View>
            <Text style={s.permitTokenLabel}>QR Token</Text>
            <View style={s.permitTokenBox}>
              <Text style={s.permitToken} selectable>{permit.qrToken}</Text>
            </View>
          </View>
        )}

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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 24, paddingBottom: 40 },
  avatarBox: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16a34a', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  username: { color: '#64748b', fontSize: 14, marginTop: 2 },
  roleBadge: { marginTop: 8, backgroundColor: '#f0fdf4', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
  roleText: { color: '#16a34a', fontSize: 12, fontWeight: '700' },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 4, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { color: '#64748b', fontSize: 14 },
  infoValue: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  permitCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  permitTitle: { fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 12 },
  permitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  permitLabel: { color: '#64748b', fontSize: 14 },
  permitValue: { color: '#0f172a', fontSize: 14, fontWeight: '600' },
  permitPlate: { color: '#0f172a', fontSize: 15, fontWeight: '800', letterSpacing: 1 },
  permitStatus: { fontSize: 14, fontWeight: '700' },
  permitTokenLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  permitTokenBox: { backgroundColor: '#f1f5f9', borderRadius: 8, padding: 10 },
  permitToken: { color: '#374151', fontSize: 11, fontFamily: 'monospace' },
  logoutBtn: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#dc2626' },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutText: { color: '#dc2626', fontWeight: '700', fontSize: 15 },
});
