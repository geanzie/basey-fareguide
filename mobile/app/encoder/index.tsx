import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

const actions = [
  { label: 'Manage Permits', sub: 'View and encode permits', route: '/encoder/permits' },
  { label: 'Vehicle Registry', sub: 'Browse registered vehicles', route: '/encoder/vehicles' },
] as const;

export default function EncoderDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Encoder Dashboard</Text>
        <Text style={s.sub}>{user?.firstName} {user?.lastName}</Text>
      </View>
      <View style={s.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
            onPress={() => router.push(a.route as never)}
          >
            <Text style={s.cardTitle}>{a.label}</Text>
            <Text style={s.cardSub}>{a.sub}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 24, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  actions: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  cardPressed: { opacity: 0.85 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
