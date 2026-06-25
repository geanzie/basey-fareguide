import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { logoutRequest } from '@/services/auth';
import { useFeedback } from '@/ui/FeedbackProvider';
import GradientHeader from '@/ui/GradientHeader';
import StatTile from '@/ui/StatTile';
import Button from '@/ui/Button';
import { colors, radii, spacing, shadow, gradients } from '@/ui/theme';
import { fetchFareHistory } from '@/services/fare';
import { fetchMyIncidents } from '@/services/incidents';

export default function PublicProfileScreen() {
  const { user, token, clearSession } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [stats, setStats] = useState<{ trips: number; reports: number } | null>(null);
  const router = useRouter();
  const { showConfirm } = useFeedback();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, r] = await Promise.all([fetchFareHistory(), fetchMyIncidents()]);
        if (active) setStats({ trips: t.items.length, reports: r.items.length });
      } catch {}
    })();
    return () => { active = false; };
  }, []);

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

  return (
    <View style={s.container}>
      <GradientHeader title="Profile">
        <View style={s.idBlock}>
          <LinearGradient colors={gradients.brandSoft} style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </LinearGradient>
          <Text style={s.name}>{user.firstName} {user.lastName}</Text>
          <Text style={s.username}>@{user.username}</Text>
          <View style={s.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#fff" />
            <Text style={s.roleText}>Public User</Text>
          </View>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.statRow}>
          <StatTile label="Trips Calculated" value={stats?.trips ?? '—'} icon="navigate" />
          <StatTile label="Reports Filed" value={stats?.reports ?? '—'} icon="warning" tone={colors.warning} />
        </View>

        <Text style={s.sectionLabel}>Account</Text>
        <View style={s.infoCard}>
          <InfoRow
            icon="pulse-outline"
            label="Status"
            value={user.isActive ? 'Active' : 'Inactive'}
            valueColor={user.isActive ? colors.primary : colors.danger}
          />
          <InfoRow
            icon="checkmark-circle-outline"
            label="Verified"
            value={user.isVerified ? 'Yes' : 'No'}
            valueColor={user.isVerified ? colors.primary : colors.textMuted}
            last
          />
        </View>

        <Text style={s.sectionLabel}>More</Text>
        <MenuItem icon="time" tint={colors.info} label="Trip History" onPress={() => router.push('/public/history')} />
        <MenuItem icon="card" tint={colors.primary} label="Discount Card" onPress={() => router.push('/public/discount')} />
        <MenuItem icon="document-text" tint={colors.info} label="Ordinance No. 105" onPress={() => router.push('/public/ordinance')} />

        <Button
          label="Sign Out"
          variant="danger"
          loading={loggingOut}
          onPress={handleLogout}
          style={s.logout}
        />
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[s.infoRow, !last && s.infoRowBorder]}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  tint,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [s.menuItem, pressed && s.pressed]} onPress={onPress}>
      <View style={[s.menuIcon, { backgroundColor: tint + '1a' }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={s.menuItemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  idBlock: { alignItems: 'center', marginTop: spacing.lg },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: '#fff' },
  username: { color: '#bbf7d0', fontSize: 14, marginTop: 2 },
  roleBadge: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  roleText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.md, marginTop: -spacing.xl - 4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  infoCard: { backgroundColor: colors.surface, borderRadius: radii.lg, ...shadow.card },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.bg },
  infoLabel: { flex: 1, color: colors.textBody, fontSize: 14 },
  infoValue: { color: colors.textStrong, fontSize: 14, fontWeight: '700' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  menuIcon: { width: 38, height: 38, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textStrong },
  pressed: { opacity: 0.7 },
  logout: { marginTop: spacing.lg },
});
