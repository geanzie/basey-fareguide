import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { terminalLookup, terminalUnlock } from '@/services/terminal';
import { ApiError } from '@/services/api';
import { useTerminalUnlockStore } from '@/store/terminalUnlockStore';
import type {
  TerminalLookupResult,
  TerminalScanDisposition,
  TerminalPermitStatus,
} from '@/types/terminal';

interface Props {
  visible: boolean;
  onClose: () => void;
  onReviewIncidents: (plateNumber: string) => void;
}

type ViewState = 'locked' | 'unlocking' | 'scanner' | 'loading' | 'result' | 'error';

const DISPOSITION_CONFIG: Record<
  TerminalScanDisposition,
  { label: string; color: string; bg: string }
> = {
  CLEAR: { label: 'CLEAR', color: '#15803d', bg: '#dcfce7' },
  FLAGGED: { label: 'FLAGGED', color: '#b45309', bg: '#fef3c7' },
  BLOCKED: { label: 'BLOCKED', color: '#dc2626', bg: '#fee2e2' },
  NOT_FOUND: { label: 'NOT FOUND', color: '#64748b', bg: '#f1f5f9' },
};

function permitBg(status: TerminalPermitStatus): string {
  if (status === 'ACTIVE') return '#dcfce7';
  if (status === 'EXPIRED') return '#fee2e2';
  if (status === 'SUSPENDED') return '#fef3c7';
  return '#f1f5f9';
}

function permitTextColor(status: TerminalPermitStatus): string {
  if (status === 'ACTIVE') return '#15803d';
  if (status === 'EXPIRED') return '#dc2626';
  if (status === 'SUSPENDED') return '#b45309';
  return '#64748b';
}

function ViolationStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={s.violationStatItem}>
      <Text style={[s.violationStatValue, { color }]}>{value}</Text>
      <Text style={s.violationStatLabel}>{label}</Text>
    </View>
  );
}

export default function QrComplianceScanModal({ visible, onClose, onReviewIncidents }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [view, setView] = useState<ViewState>('locked');
  const [result, setResult] = useState<TerminalLookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      setResult(null);
      setErrorMsg('');
      setPassword('');
      setUnlockError('');
      // Skip the password gate if a valid unlock token is still in memory.
      setView(useTerminalUnlockStore.getState().isUnlocked() ? 'scanner' : 'locked');
      if (!permission?.granted) requestPermission();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleUnlock = async () => {
    if (!password.trim()) {
      setUnlockError('Enter your password to unlock the terminal.');
      return;
    }
    setUnlockError('');
    setView('unlocking');
    try {
      await terminalUnlock(password);
      setPassword('');
      scannedRef.current = false;
      setView('scanner');
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Unable to unlock the terminal.');
      setView('locked');
    }
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setView('loading');

    try {
      const res = await terminalLookup(data);
      setResult(res);
      setView('result');
    } catch (err) {
      // Unlock expired mid-session — drop the stale token and re-prompt.
      if (err instanceof ApiError && err.status === 403) {
        useTerminalUnlockStore.getState().clearUnlock();
        setUnlockError('The terminal unlock expired. Re-enter your password to continue.');
        scannedRef.current = false;
        setView('locked');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed. Try again.');
      setView('error');
    }
  };

  const handleScanAnother = () => {
    scannedRef.current = false;
    setResult(null);
    setErrorMsg('');
    setView('scanner');
  };

  const handleReviewIncidents = () => {
    if (!result?.vehicle) return;
    onReviewIncidents(result.vehicle.plateNumber);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={s.container}>

        {/* ── Locked gate ── */}
        {(view === 'locked' || view === 'unlocking') && (
          <KeyboardAvoidingView
            style={s.lockWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Text style={s.lockTitle}>Terminal Locked</Text>
            <Text style={s.lockSubtitle}>
              Re-enter your password to unlock the QR compliance terminal.
            </Text>
            <TextInput
              style={s.lockInput}
              placeholder="Password"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              editable={view === 'locked'}
              onSubmitEditing={handleUnlock}
              returnKeyType="go"
            />
            {unlockError ? <Text style={s.lockError}>{unlockError}</Text> : null}
            <Pressable
              style={[s.lockBtn, view === 'unlocking' && s.lockBtnDisabled]}
              onPress={handleUnlock}
              disabled={view === 'unlocking'}
            >
              {view === 'unlocking' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.lockBtnText}>Unlock Terminal</Text>
              )}
            </Pressable>
            <Pressable style={s.cancelTextBtn} onPress={onClose}>
              <Text style={s.cancelTextBtnText}>Cancel</Text>
            </Pressable>
          </KeyboardAvoidingView>
        )}

        {/* ── Scanner view ── */}
        {view === 'scanner' && (
          permission?.granted ? (
            <View style={s.cameraWrap}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleScan}
              />
              <View style={s.overlay}>
                <View style={s.topBar}>
                  <Text style={s.topBarTitle}>Compliance Scan</Text>
                  <Pressable onPress={onClose} style={s.closeBtn}>
                    <Text style={s.closeBtnText}>Cancel</Text>
                  </Pressable>
                </View>
                <View style={s.finderWrap}>
                  <View style={s.finder}>
                    <View style={[s.corner, s.cornerTL]} />
                    <View style={[s.corner, s.cornerTR]} />
                    <View style={[s.corner, s.cornerBL]} />
                    <View style={[s.corner, s.cornerBR]} />
                  </View>
                </View>
                <Text style={s.hint}>Point camera at driver's permit QR code</Text>
              </View>
            </View>
          ) : (
            <View style={s.permissionWrap}>
              <Text style={s.permissionText}>
                Camera permission required to scan QR codes.
              </Text>
              <Pressable style={s.permissionBtn} onPress={requestPermission}>
                <Text style={s.permissionBtnText}>Grant Permission</Text>
              </Pressable>
              <Pressable style={s.cancelTextBtn} onPress={onClose}>
                <Text style={s.cancelTextBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )
        )}

        {/* ── Loading view ── */}
        {view === 'loading' && (
          <View style={s.stateWrap}>
            <ActivityIndicator color="#16a34a" size="large" />
            <Text style={s.stateText}>Checking compliance...</Text>
          </View>
        )}

        {/* ── Error view ── */}
        {view === 'error' && (
          <View style={s.stateWrap}>
            <Text style={s.errorTitle}>Scan Failed</Text>
            <Text style={s.errorMsg}>{errorMsg}</Text>
            <Pressable style={s.retryBtn} onPress={handleScanAnother}>
              <Text style={s.retryBtnText}>Try Again</Text>
            </Pressable>
            <Pressable style={s.cancelTextBtn} onPress={onClose}>
              <Text style={s.cancelTextBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* ── Result view ── */}
        {view === 'result' && result && (
          <>
            <View style={s.resultHeader}>
              <Text style={s.resultHeaderTitle}>Compliance Check</Text>
              <Pressable onPress={onClose} style={s.closeBtn}>
                <Text style={[s.closeBtnText, { color: '#374151' }]}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={s.resultScroll} contentContainerStyle={s.resultContent}>
              {/* Disposition badge */}
              {(() => {
                const cfg = DISPOSITION_CONFIG[result.scanDisposition];
                return (
                  <View style={[s.dispositionBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.dispositionText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                    <Text style={[s.dispositionMsg, { color: cfg.color }]}>
                      {result.message}
                    </Text>
                  </View>
                );
              })()}

              {/* Vehicle */}
              {result.vehicle ? (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Vehicle</Text>
                  <Text style={s.plateNumber}>{result.vehicle.plateNumber}</Text>
                  <Text style={s.vehicleDetail}>
                    {[result.vehicle.vehicleType, result.vehicle.make, result.vehicle.model]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {result.vehicle.driverName ? (
                    <Text style={s.vehicleMeta}>Driver: {result.vehicle.driverName}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Permit */}
              {result.permitStatus ? (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Permit</Text>
                  <View style={s.permitRow}>
                    <Text style={s.permitStatusLabel}>Status</Text>
                    <View style={[s.permitBadge, { backgroundColor: permitBg(result.permitStatus) }]}>
                      <Text style={[s.permitBadgeText, { color: permitTextColor(result.permitStatus) }]}>
                        {result.permitStatus}
                      </Text>
                    </View>
                  </View>
                  {result.permit?.expiryDate ? (
                    <Text style={s.vehicleMeta}>
                      Expires:{' '}
                      {new Date(result.permit.expiryDate).toLocaleDateString('en-PH')}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Compliance checklist */}
              {result.complianceChecklist.length > 0 ? (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Compliance Checklist</Text>
                  {result.complianceChecklist.map((item, i) => (
                    <View key={i} style={s.checkRow}>
                      <Text style={item.passed ? s.checkPass : s.checkFail}>
                        {item.passed ? '✓' : '✗'}
                      </Text>
                      <View style={s.checkContent}>
                        <Text style={s.checkLabel}>{item.label}</Text>
                        {item.detail ? (
                          <Text style={s.checkDetail}>{item.detail}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Violations */}
              {result.violationSummary ? (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Violations</Text>
                  <View style={s.violationStats}>
                    <ViolationStat
                      label="Open Incidents"
                      value={result.violationSummary.openIncidents}
                      color="#dc2626"
                    />
                    <ViolationStat
                      label="Unpaid Tickets"
                      value={result.violationSummary.unpaidTickets}
                      color="#b45309"
                    />
                    <ViolationStat
                      label="Total"
                      value={result.violationSummary.totalViolations}
                      color="#374151"
                    />
                  </View>
                  {result.violationSummary.outstandingPenalties > 0 ? (
                    <Text style={s.outstandingPenalty}>
                      Outstanding: ₱
                      {result.violationSummary.outstandingPenalties.toFixed(2)}
                    </Text>
                  ) : null}
                  {result.violationSummary.recentViolations.slice(0, 3).map((v, i) => (
                    <View key={i} style={s.violationItem}>
                      <Text style={s.violationItemType}>
                        {v.incidentType.replace(/_/g, ' ')}
                      </Text>
                      <Text style={s.violationItemMeta}>
                        {v.status.replace(/_/g, ' ')} ·{' '}
                        {new Date(v.incidentDate).toLocaleDateString('en-PH')}
                      </Text>
                      {v.penaltyAmount != null ? (
                        <Text style={s.violationItemAmount}>
                          ₱{v.penaltyAmount.toFixed(2)}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {/* Actions */}
            <View style={s.resultActions}>
              <Pressable style={s.scanAnotherBtn} onPress={handleScanAnother}>
                <Text style={s.scanAnotherText}>Scan Another</Text>
              </Pressable>
              <Pressable
                style={[s.reviewBtn, !result.vehicle && s.reviewBtnDisabled]}
                onPress={handleReviewIncidents}
                disabled={!result.vehicle}
              >
                <Text style={s.reviewBtnText}>Review Incidents</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const CORNER_SIZE = 22;
const CORNER_THICKNESS = 4;
const CORNER_COLOR = '#16a34a';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrap: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 56,
  },
  topBarTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#fff', fontSize: 16 },
  finderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  finder: { width: 240, height: 240, position: 'relative' },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  hint: { color: '#fff', textAlign: 'center', fontSize: 14, paddingBottom: 60 },

  lockWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0f172a',
  },
  lockTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  lockSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  lockInput: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  lockError: { color: '#f87171', fontSize: 13, marginTop: 12, textAlign: 'center' },
  lockBtn: {
    width: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  lockBtnDisabled: { opacity: 0.6 },
  lockBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  permissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0f172a',
  },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 15, marginBottom: 24 },
  permissionBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelTextBtn: { marginTop: 16 },
  cancelTextBtnText: { color: '#94a3b8', fontSize: 15 },

  stateWrap: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  stateText: { color: '#374151', fontSize: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#dc2626' },
  errorMsg: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 56,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  resultHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  resultScroll: { flex: 1, backgroundColor: '#f1f5f9' },
  resultContent: { padding: 16, gap: 12 },

  dispositionBadge: {
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  dispositionText: { fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  dispositionMsg: { fontSize: 13, textAlign: 'center' },

  section: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },

  plateNumber: { fontSize: 22, fontWeight: '800', color: '#0f172a', letterSpacing: 2 },
  vehicleDetail: { fontSize: 13, color: '#374151' },
  vehicleMeta: { fontSize: 12, color: '#64748b' },

  permitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  permitStatusLabel: { fontSize: 13, color: '#374151' },
  permitBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  permitBadgeText: { fontSize: 12, fontWeight: '700' },

  checkRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkPass: { fontSize: 16, color: '#16a34a', fontWeight: '700', width: 20 },
  checkFail: { fontSize: 16, color: '#dc2626', fontWeight: '700', width: 20 },
  checkContent: { flex: 1, gap: 2 },
  checkLabel: { fontSize: 13, color: '#0f172a' },
  checkDetail: { fontSize: 12, color: '#64748b' },

  violationStats: { flexDirection: 'row', gap: 8 },
  violationStatItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  violationStatValue: { fontSize: 22, fontWeight: '800' },
  violationStatLabel: { fontSize: 10, color: '#64748b', textAlign: 'center' },
  outstandingPenalty: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
  violationItem: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, gap: 2 },
  violationItemType: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  violationItemMeta: { fontSize: 12, color: '#64748b' },
  violationItemAmount: { fontSize: 12, fontWeight: '600', color: '#dc2626' },

  resultActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingBottom: 32,
  },
  scanAnotherBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  scanAnotherText: { fontWeight: '700', color: '#374151', fontSize: 14 },
  reviewBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#16a34a',
  },
  reviewBtnDisabled: { opacity: 0.4 },
  reviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
