import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <Text style={s.code}>404</Text>
      <Text style={s.msg}>Page not found</Text>
      <Pressable style={s.btn} onPress={() => router.replace('/')}>
        <Text style={s.btnText}>Go home</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  code: { fontSize: 64, fontWeight: '900', color: '#e2e8f0' },
  msg: { fontSize: 18, color: '#64748b', marginBottom: 24 },
  btn: { backgroundColor: '#16a34a', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '700' },
});
