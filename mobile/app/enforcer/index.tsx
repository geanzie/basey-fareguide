import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';

export default function EnforcerDashboard() {
  const { user } = useAuthStore();

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Enforcement Dashboard</Text>
        <Text style={s.sub}>{user?.firstName} {user?.lastName}</Text>
      </View>
      <View style={s.infoCard}>
        <Text style={s.infoText}>
          Use the Queue tab to manage incoming incident reports. Accept cases, verify evidence, issue tickets, and record payments.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 24, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  infoCard: { margin: 16, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  infoText: { color: '#374151', fontSize: 14, lineHeight: 22 },
});
