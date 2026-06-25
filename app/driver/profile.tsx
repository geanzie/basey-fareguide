import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { logoutRequest } from '@/services/auth';
import { useFeedback } from '@/ui/FeedbackProvider';
import { api } from '@/services/api';
import GradientHeader from '@/ui/GradientHeader';
import StatTile from '@/ui/StatTile';
import Button from '@/ui/Button';
import { StatGridSkeleton } from '@/ui/Skeleton';
import { colors, radii, spacing, shadow, gradients } from '@/ui/theme';

interface DriverSummary {
  fareCalculationCount: number;
  totalIncidents: number;
  openIncidents: number;
  unpaidTickets: number;
  outstandingPenalties: number;
}

export default function DriverProfileScreen() {
  const { user, token, clearSession } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);
  const [summary, setSummary] = useState<DriverSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const router = useRouter();
  const { showConfirm } = useFeedback();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get<{ summary: DriverSummary }>('/api/driver/summary');
        if (active) setSummary(res.summary);
      } catch {} finally {
        if (active) setLoadingStats(false);
      }
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
            <Ionicons name="car" size={12} color="#fff" />
            <Text style={s.roleText}>Driver</Text>
          </View>
        </View>
      </GradientHeader>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.sectionLabel}>My Records</Text>
        {loadingStats ? (
          <StatGridSkeleton count={4} />
        ) : (
          <View style={s.statGrid}>
            <StatTile label="Fare Calcs" value={summary?.fareCalculationCount ?? 0} icon="navigate" tone={colors.info} />
            <StatTile label="Incidents" value={summary?.totalIncidents ?? 0} icon="warning" tone={colors.warning} />
            <StatTile label="Open" value={summary?.openIncidents ?? 0} icon="alert-circle" tone={(summary?.openIncidents ?? 0) > 0 ? colors.danger : colors.textMuted} />
            <StatTile label="Unpaid Tickets" value={summary?.unpaidTickets ?? 0} icon="receipt" tone={(summary?.unpaidTickets ?? 0) > 0 ? colors.danger : colors.textMuted} />
          </View>
        )}

        {summary && summary.outstandingPenalties > 0 ? (
          <View style={s.penaltyBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={s.penaltyText}>You owe ₱{summary.outstandingPenalties.toFixed(2)} in penalties</Text>
          </View>
        ) : null}

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

        <Button label="Change Password" variant="secondary" onPress={() => router.push('/change-password' as never)} style={s.logout} />
        <Button label="Sign Out" variant="danger" loading={loggingOut} onPress={handleLogout} style={s.signOut} />
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  penaltyBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.dangerSoftBg, borderRadius: radii.md, padding: spacing.md, borderWidth: 1, borderColor: colors.dangerSoftBorder },
  penaltyText: { color: colors.danger, fontWeight: '700', fontSize: 13, flex: 1 },
  infoCard: { backgroundColor: colors.surface, borderRadius: radii.lg, ...shadow.card },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.bg },
  infoLabel: { flex: 1, color: colors.textBody, fontSize: 14 },
  infoValue: { color: colors.textStrong, fontSize: 14, fontWeight: '700' },
  logout: { marginTop: spacing.lg },
  signOut: { marginTop: spacing.md },
});
