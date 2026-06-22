import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { lookupByRideTag } from '@/services/vehicles';
import type { VehicleLookup } from '@/types/fare';

interface Props {
  visible: boolean;
  onVehicleFound: (vehicle: VehicleLookup) => void;
  onClose: () => void;
}

export default function QRScannerModal({ visible, onVehicleFound, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
      if (!permission?.granted) requestPermission();
    }
  }, [visible]);

  const handleScan = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    try {
      const vehicle = await lookupByRideTag(data);
      if (vehicle) {
        onVehicleFound(vehicle);
        onClose();
      } else {
        Alert.alert('Not Found', 'No active vehicle matched this QR code.', [
          { text: 'Try Again', onPress: () => { scannedRef.current = false; } },
          { text: 'Cancel', onPress: onClose },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Could not look up this QR code.', [
        { text: 'Retry', onPress: () => { scannedRef.current = false; } },
        { text: 'Cancel', onPress: onClose },
      ]);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={s.container}>
        {permission?.granted ? (
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
          >
            <View style={s.overlay}>
              <View style={s.topBar}>
                <Text style={s.topBarTitle}>Scan Operator QR</Text>
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

              <Text style={s.hint}>Point camera at the driver's QR code</Text>
            </View>
          </CameraView>
        ) : (
          <View style={s.permissionWrap}>
            <Text style={s.permissionText}>Camera permission required to scan QR codes.</Text>
            <Pressable style={s.permissionBtn} onPress={requestPermission}>
              <Text style={s.permissionBtnText}>Grant Permission</Text>
            </Pressable>
            <Pressable style={s.cancelTextBtn} onPress={onClose}>
              <Text style={s.cancelTextBtnText}>Cancel</Text>
            </Pressable>
          </View>
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
  camera: { flex: 1 },
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
  finder: {
    width: 240,
    height: 240,
    position: 'relative',
  },
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
  permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 15, marginBottom: 24 },
  permissionBtn: { backgroundColor: '#16a34a', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelTextBtn: { marginTop: 16 },
  cancelTextBtnText: { color: '#94a3b8', fontSize: 15 },
});
