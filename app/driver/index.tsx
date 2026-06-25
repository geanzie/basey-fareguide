import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { StatGridSkeleton, SectionSkeleton } from '@/ui/Skeleton';
import GradientHeader from '@/ui/GradientHeader';
import Button from '@/ui/Button';
import EmptyState from '@/ui/EmptyState';
import { colors, radii, spacing, shadow } from '@/ui/theme';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useFeedback } from '@/ui/FeedbackProvider';

const POLL_INTERVAL_MS = 15000;
const VISIBLE_SECTION_KEYS = ['pending', 'boarded'];

interface DriverSession {
  driver: { id: string; firstName: string; lastName: string };
  vehicle: { id: string; plateNumber: string; vehicleType: string; make: string; model: string } | null;
  session: {
    id: string | null;
    status: string | null;
    activeRiderCount: number;
    pendingCount: number;
    boardedCount: number;
    canStartSession: boolean;
    canCloseSession: boolean;
  };
  sections: Array<{
    key: string;
    riders: Array<{
      id: string;
      origin: string;
      destination: string;
      fareSnapshot: number;
      status: string;
      joinedAt: string;
      availableActions: Array<{ action: string; label: string; kind: 'positive' | 'negative' }>;
    }>;
  }>;
}

interface DriverSummary {
  summary: {
    fareCalculationCount: number;
    totalIncidents: number;
    openIncidents: number;
    unpaidTickets: number;
    outstandingPenalties: number;
  };
}

interface PermitQrData {
  permitPlateNumber: string;
  driverFullName: string;
  permitStatus: string;
  permitExpiryDate: string;
  qrToken: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function DriverTripScreen() {
  const { user } = useAuthStore();
  const { showError, showWarning, showConfirm } = useFeedback();
  const [data, setData] = useState<DriverSession | null>(null);
  const [summary, setSummary] = useState<DriverSummary['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [permitQr, setPermitQr] = useState<PermitQrData | null>(null);
  const [permitQrLoading, setPermitQrLoading] = useState(false);
  const [showPermitQr, setShowPermitQr] = useState(false);

  const load = useCallback(async () => {
    try {
      const [session, sum] = await Promise.allSettled([
        api.get<DriverSession>('/api/driver/session/active'),
        api.get<DriverSummary>('/api/driver/summary'),
      ]);
      if (session.status === 'fulfilled') setData(session.value);
      if (sum.status === 'fulfilled') setSummary(sum.value.summary);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load(), POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const startSession = async () => {
    setActing('start');
    try {
      await api.post('/api/driver/session/start', {});
      await load();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not start session.');
    } finally {
      setActing(null);
    }
  };

  const closeSession = async () => {
    if (!data?.session.id) return;
    showConfirm({
      title: 'Go Offline',
      message: 'Stop accepting riders and end this session?',
      confirmLabel: 'Go Offline',
      destructive: true,
      onConfirm: async () => {
        setActing('close');
        try {
          await api.post(`/api/driver/session/${data.session.id}/close`, {});
          await load();
        } catch (err) {
          showError(err instanceof Error ? err.message : 'Could not close session.');
        } finally {
          setActing(null);
        }
      },
    });
  };

  const riderAction = async (sessionId: string, riderId: string, action: string) => {
    setActing(`${riderId}:${action}`);
    try {
      await api.post(`/api/driver/session/${sessionId}/riders/${riderId}/action`, { action });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SESSION_RIDER_EXPIRED') {
        showWarning(
          'This trip request timed out before you could respond, so it was removed from your list.',
          { title: 'Trip Request Expired' },
        );
      } else {
        showError(err instanceof Error ? err.message : 'Action failed.');
      }
    } finally {
      await load();
      setActing(null);
    }
  };

  const handleViewPermitQr = async () => {
    if (permitQr) { setShowPermitQr(true); return; }
    setPermitQrLoading(true);
    try {
      const qrData = await api.get<PermitQrData>('/api/driver/permit/qr');
      setPermitQr(qrData);
      setShowPermitQr(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not load permit QR.');
    } finally {
      setPermitQrLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.container}>
        <GradientHeader title="Trip Session" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
        <StatGridSkeleton count={3} />
        <SectionSkeleton count={3} />
      </View>
    );
  }

  const session = data?.session;
  const vehicle = data?.vehicle;
  // Online = an active (OPEN/IN_PROGRESS) session exists. canCloseSession is a
  // separate gate (false while riders are still active), so it must NOT be used
  // to decide online-state.
  const isOnline = Boolean(session?.status);
  const blockedFromClosing = isOnline && !session?.canCloseSession;

  const visibleSections = (data?.sections ?? [])
    .filter((section) => VISIBLE_SECTION_KEYS.includes(section.key))
    .map((section) => ({
      ...section,
      // Keep stale pendings visible so the driver can always act (Decline) on
      // them; the backend expires them on action or on Go Offline.
      riders: section.riders.filter((rider) => rider.status !== 'EXPIRED'),
    }))
    .filter((section) => section.riders.length > 0);

  return (
    <View style={s.container}>
      <GradientHeader title="Trip Session" subtitle={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`} />
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {summary && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>OVERVIEW</Text>
            <View style={s.summaryRow}>
              {[
                { label: 'Fare Calcs', value: summary.fareCalculationCount },
                { label: 'Incidents', value: summary.totalIncidents },
                { label: 'Open', value: summary.openIncidents, alert: summary.openIncidents > 0 },
                { label: 'Unpaid', value: summary.unpaidTickets, alert: summary.unpaidTickets > 0 },
              ].map((item) => (
                <View key={item.label} style={s.summaryStat}>
                  <Text style={[s.summaryVal, item.alert ? s.alertText : null]}>{item.value}</Text>
                  <Text style={s.summaryLbl}>{item.label}</Text>
                </View>
              ))}
            </View>
            {summary.outstandingPenalties > 0 && (
              <View style={s.penaltyBanner}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={s.penaltyText}>
                  Outstanding penalties: ₱{summary.outstandingPenalties.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        {vehicle ? (
          <View style={s.vehicleCard}>
            <View style={s.vehicleIcon}>
              <Ionicons name="car" size={22} color={colors.onPrimary} />
            </View>
            <View style={s.flex1}>
              <Text style={s.plate}>{vehicle.plateNumber}</Text>
              <Text style={s.vehicleInfo}>
                {vehicle.vehicleType.replace(/_/g, ' ')} · {vehicle.make} {vehicle.model}
              </Text>
            </View>
          </View>
        ) : (
          <View style={s.noVehicleCard}>
            <Ionicons name="warning" size={18} color={colors.warningDark} />
            <Text style={s.noVehicleText}>No vehicle assigned. Contact administrator.</Text>
          </View>
        )}

        {vehicle && session && (
          <View style={s.sessionCard}>
            {/* Status hero */}
            <View style={s.statusRow}>
              <View style={s.statusLeft}>
                <View style={[s.statusDot, { backgroundColor: isOnline ? colors.primary : colors.textFaint }]} />
                <View style={s.flex1}>
                  <Text style={s.statusLabel}>{isOnline ? 'Online' : 'Offline'}</Text>
                  <Text style={s.statusSub}>
                    {blockedFromClosing
                      ? 'Finish active riders to go offline'
                      : isOnline ? 'Accepting riders' : 'Not accepting riders'}
                  </Text>
                </View>
              </View>
              {session.canStartSession && (
                <Button label="Go Online" onPress={startSession} loading={acting === 'start'} />
              )}
              {isOnline && (
                <Button
                  label="Go Offline"
                  variant="danger"
                  onPress={closeSession}
                  loading={acting === 'close'}
                  disabled={blockedFromClosing}
                />
              )}
            </View>

            <View style={s.statsRow}>
              {[
                { label: 'Pending', value: session.pendingCount, tone: colors.warning },
                { label: 'Boarded', value: session.boardedCount, tone: colors.primary },
                { label: 'Active', value: session.activeRiderCount, tone: colors.textStrong },
              ].map((stat) => (
                <View key={stat.label} style={s.stat}>
                  <Text style={[s.statVal, { color: stat.tone }]}>{stat.value}</Text>
                  <Text style={s.statLbl}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {visibleSections.map((section) => (
          <View key={section.key} style={s.section}>
            <Text style={s.sectionTitle}>{section.key.toUpperCase()}</Text>
            {section.riders.map((rider) => (
              <View key={rider.id} style={s.riderCard}>
                <View style={s.riderTop}>
                  <View style={s.flex1}>
                    <View style={s.routeLine}>
                      <Ionicons name="ellipse" size={9} color={colors.warning} />
                      <Text style={s.routeText} numberOfLines={1}>{rider.origin}</Text>
                    </View>
                    <View style={s.routeConnector} />
                    <View style={s.routeLine}>
                      <Ionicons name="location" size={11} color={colors.primary} />
                      <Text style={s.routeText} numberOfLines={1}>{rider.destination}</Text>
                    </View>
                  </View>
                  <View style={s.riderRight}>
                    <Text style={s.riderFare}>₱{Number(rider.fareSnapshot).toFixed(2)}</Text>
                    <Text style={s.riderTime}>{timeAgo(rider.joinedAt)}</Text>
                  </View>
                </View>
                {rider.availableActions.length > 0 && session?.id && (
                  <View style={s.riderBtnRow}>
                    {rider.availableActions.map((btn) => {
                      const actionKey = `${rider.id}:${btn.action}`;
                      const riderBusy = acting?.startsWith(`${rider.id}:`) ?? false;
                      return (
                        <Button
                          key={btn.action}
                          label={btn.label}
                          size="sm"
                          variant={btn.kind === 'positive' ? 'primary' : 'secondary'}
                          onPress={() => riderAction(session.id!, rider.id, btn.action)}
                          loading={acting === actionKey}
                          disabled={riderBusy && acting !== actionKey}
                          style={s.flex1}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}

        {isOnline && visibleSections.length === 0 && (
          <EmptyState icon="time-outline" title="Waiting for riders…" message="You're online. New trip requests will appear here." />
        )}
      </ScrollView>

      <Pressable
        style={[s.fab, permitQrLoading && s.fabDisabled]}
        onPress={() => void handleViewPermitQr()}
        disabled={permitQrLoading}
      >
        <Ionicons name="qr-code-outline" size={26} color={colors.onPrimary} />
      </Pressable>

      <Modal
        visible={showPermitQr}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPermitQr(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setShowPermitQr(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>My Permit QR</Text>
            <Text style={s.modalSub}>Show this at the compliance terminal.</Text>
            {permitQr && (
              <>
                <QRCode value={permitQr.qrToken} size={220} />
                <Text style={s.modalPlate}>{permitQr.permitPlateNumber}</Text>
                <Text style={s.modalDriver}>{permitQr.driverFullName}</Text>
              </>
            )}
            <Button label="Close" variant="secondary" onPress={() => setShowPermitQr(false)} style={s.modalCloseBtn} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: spacing.md, paddingBottom: 96 },
  flex1: { flex: 1 },

  summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, ...shadow.card },
  summaryTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: spacing.md, letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryStat: { alignItems: 'center' },
  summaryVal: { fontSize: 24, fontWeight: '800', color: colors.textStrong },
  alertText: { color: colors.danger },
  summaryLbl: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  penaltyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.dangerSoftBg, borderRadius: radii.md, padding: 10, marginTop: spacing.md },
  penaltyText: { color: colors.danger, fontWeight: '700', fontSize: 13 },

  vehicleCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.textStrong, borderRadius: radii.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vehicleIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  plate: { fontSize: 22, fontWeight: '900', color: colors.onPrimary, letterSpacing: 2 },
  vehicleInfo: { color: colors.textFaint, marginTop: 2, fontSize: 13 },
  noVehicleCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: '#fef3c7', borderRadius: radii.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noVehicleText: { color: colors.warningDark, fontWeight: '600', flex: 1 },

  sessionCard: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.md, gap: spacing.lg, ...shadow.card },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusLabel: { fontSize: 16, fontWeight: '800', color: colors.textStrong },
  statusSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: colors.bg, paddingTop: spacing.lg },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 28, fontWeight: '800', color: colors.textStrong },
  statLbl: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 2 },

  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  riderCard: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 14, marginBottom: spacing.sm, ...shadow.card },
  riderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  routeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  routeText: { flex: 1, fontWeight: '600', color: colors.textStrong, fontSize: 14 },
  routeConnector: { width: 1, height: 10, backgroundColor: colors.border, marginLeft: 5, marginVertical: 1 },
  riderRight: { alignItems: 'flex-end' },
  riderFare: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  riderTime: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  riderBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', ...shadow.raised },
  fabDisabled: { opacity: 0.7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  modalSub: { fontSize: 13, color: colors.textMuted, marginBottom: 20 },
  modalPlate: { fontSize: 18, fontWeight: '900', color: colors.textStrong, letterSpacing: 2, marginTop: 16 },
  modalDriver: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  modalCloseBtn: { alignSelf: 'stretch' },
});
