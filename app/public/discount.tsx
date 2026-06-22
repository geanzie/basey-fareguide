import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { FormSkeleton } from '@/ui/Skeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

type DiscountType = 'SENIOR_CITIZEN' | 'PWD' | 'STUDENT';

interface DiscountCard {
  id: string;
  discountType: DiscountType;
  verificationStatus: string;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

interface CardStatusResponse {
  hasDiscountCard: boolean;
  isValid?: boolean;
  discountCard: DiscountCard | null;
}

const DISCOUNT_OPTIONS: { label: string; value: DiscountType; desc: string }[] = [
  { label: 'Senior Citizen', value: 'SENIOR_CITIZEN', desc: 'Age 60 and above' },
  { label: 'PWD', value: 'PWD', desc: 'Person with Disability' },
  { label: 'Student', value: 'STUDENT', desc: 'Currently enrolled student' },
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  APPROVED: '#16a34a',
  REJECTED: '#dc2626',
  SUSPENDED: '#64748b',
};

export default function DiscountCardScreen() {
  const { token } = useAuthStore();
  const router = useRouter();
  const [cardStatus, setCardStatus] = useState<CardStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [discountType, setDiscountType] = useState<DiscountType>('SENIOR_CITIZEN');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idType, setIdType] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [schoolIdExpiry, setSchoolIdExpiry] = useState('');
  const [disabilityType, setDisabilityType] = useState('');
  const [pwdIdExpiry, setPwdIdExpiry] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<CardStatusResponse>('/api/discount-cards/me');
      setCardStatus(res);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to upload your ID photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoFileName(asset.fileName ?? `id_photo_${Date.now()}.jpg`);
    }
  };

  const submit = async () => {
    if (!fullName.trim()) { Alert.alert('Required', 'Full name is required.'); return; }
    if (!dateOfBirth.trim()) { Alert.alert('Required', 'Date of birth is required (YYYY-MM-DD).'); return; }
    if (!photoUri || !photoFileName) { Alert.alert('Required', 'Please upload a photo of your ID.'); return; }
    if (discountType === 'STUDENT') {
      if (!schoolName.trim()) { Alert.alert('Required', 'School name is required.'); return; }
      if (!gradeLevel.trim()) { Alert.alert('Required', 'Grade/Year level is required.'); return; }
      if (!schoolIdExpiry.trim()) { Alert.alert('Required', 'School ID expiry is required (YYYY-MM-DD).'); return; }
    }
    if (discountType === 'PWD') {
      if (!disabilityType.trim()) { Alert.alert('Required', 'Disability type is required.'); return; }
      if (!pwdIdExpiry.trim()) { Alert.alert('Required', 'PWD ID expiry is required (YYYY-MM-DD).'); return; }
      if (!idNumber.trim()) { Alert.alert('Required', 'PWD ID number is required.'); return; }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('discountType', discountType);
      formData.append('fullName', fullName.trim());
      formData.append('dateOfBirth', dateOfBirth.trim());
      if (idNumber.trim()) formData.append('idNumber', idNumber.trim());
      if (idType.trim()) formData.append('idType', idType.trim());
      if (discountType === 'STUDENT') {
        formData.append('schoolName', schoolName.trim());
        formData.append('gradeLevel', gradeLevel.trim());
        formData.append('schoolIdExpiry', schoolIdExpiry.trim());
      }
      if (discountType === 'PWD') {
        formData.append('disabilityType', disabilityType.trim());
        formData.append('pwdIdExpiry', pwdIdExpiry.trim());
      }
      formData.append('photo', {
        uri: photoUri,
        name: photoFileName,
        type: 'image/jpeg',
      } as unknown as Blob);

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL ?? ''}/api/discount-cards/apply`,
        {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: formData,
        },
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
      }

      Alert.alert('Application Submitted', 'Your discount card application has been submitted for review.');
      setShowForm(false);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <FormSkeleton fields={3} />
      </SafeAreaView>
    );
  }

  if (cardStatus?.hasDiscountCard && cardStatus.discountCard) {
    const card = cardStatus.discountCard;
    const statusColor = STATUS_COLOR[card.verificationStatus] ?? '#64748b';
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.content}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Back</Text>
          </Pressable>
          <Text style={s.title}>Discount Card</Text>
          <View style={s.statusCard}>
            <View style={[s.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[s.statusBadgeText, { color: statusColor }]}>
                {card.verificationStatus}
              </Text>
            </View>
            <Text style={s.cardType}>{card.discountType.replace('_', ' ')}</Text>
            {cardStatus.isValid !== undefined && (
              <Text style={[s.validText, { color: cardStatus.isValid ? '#16a34a' : '#dc2626' }]}>
                {cardStatus.isValid ? 'Valid' : 'Invalid / Expired'}
              </Text>
            )}
            <View style={s.dateRow}>
              <Text style={s.dateMeta}>Valid from: {new Date(card.validFrom).toLocaleDateString('en-PH')}</Text>
              <Text style={s.dateMeta}>Valid until: {new Date(card.validUntil).toLocaleDateString('en-PH')}</Text>
            </View>
          </View>
          {card.verificationStatus === 'PENDING' && (
            <View style={s.infoBox}>
              <Text style={s.infoText}>Your application is under review. We will notify you once it is processed.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showForm) {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.formHeader}>
            <Text style={s.title}>Apply for Discount Card</Text>
            <Pressable onPress={() => setShowForm(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
          </View>

          <Text style={s.sectionLabel}>Discount Type</Text>
          <View style={s.chipRow}>
            {DISCOUNT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[s.chip, discountType === opt.value && s.chipActive]}
                onPress={() => setDiscountType(opt.value)}
              >
                <Text style={[s.chipText, discountType === opt.value && s.chipTextActive]}>{opt.label}</Text>
                <Text style={[s.chipDesc, discountType === opt.value && s.chipDescActive]}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.fieldLabel}>Full Name</Text>
          <TextInput style={s.input} value={fullName} onChangeText={setFullName} placeholder="As it appears on your ID" placeholderTextColor="#94a3b8" />

          <Text style={s.fieldLabel}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput style={s.input} value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="e.g. 1960-01-15" placeholderTextColor="#94a3b8" keyboardType="numeric" />

          <Text style={s.fieldLabel}>ID Number (optional)</Text>
          <TextInput style={s.input} value={idNumber} onChangeText={setIdNumber} placeholder="Government ID number" placeholderTextColor="#94a3b8" />

          <Text style={s.fieldLabel}>ID Type (optional)</Text>
          <TextInput style={s.input} value={idType} onChangeText={setIdType} placeholder="e.g. SSS, PhilHealth, UMID" placeholderTextColor="#94a3b8" />

          {discountType === 'STUDENT' && (
            <>
              <Text style={s.fieldLabel}>School Name</Text>
              <TextInput style={s.input} value={schoolName} onChangeText={setSchoolName} placeholder="Name of school" placeholderTextColor="#94a3b8" />
              <Text style={s.fieldLabel}>Grade/Year Level</Text>
              <TextInput style={s.input} value={gradeLevel} onChangeText={setGradeLevel} placeholder="e.g. Grade 11, 2nd Year College" placeholderTextColor="#94a3b8" />
              <Text style={s.fieldLabel}>School ID Expiry (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={schoolIdExpiry} onChangeText={setSchoolIdExpiry} placeholder="e.g. 2025-06-30" placeholderTextColor="#94a3b8" keyboardType="numeric" />
            </>
          )}

          {discountType === 'PWD' && (
            <>
              <Text style={s.fieldLabel}>PWD ID Number</Text>
              <TextInput style={s.input} value={idNumber} onChangeText={setIdNumber} placeholder="PWD ID number" placeholderTextColor="#94a3b8" />
              <Text style={s.fieldLabel}>Type of Disability</Text>
              <TextInput style={s.input} value={disabilityType} onChangeText={setDisabilityType} placeholder="e.g. Physical, Visual, Hearing" placeholderTextColor="#94a3b8" />
              <Text style={s.fieldLabel}>PWD ID Expiry (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={pwdIdExpiry} onChangeText={setPwdIdExpiry} placeholder="e.g. 2025-12-31" placeholderTextColor="#94a3b8" keyboardType="numeric" />
            </>
          )}

          <Text style={s.fieldLabel}>ID Photo</Text>
          <Pressable style={s.photoBtn} onPress={pickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photoPreview} />
            ) : (
              <Text style={s.photoBtnText}>Tap to select photo</Text>
            )}
          </Pressable>
          {photoUri && (
            <Pressable onPress={pickPhoto} style={s.changePhotoLink}>
              <Text style={s.changePhotoText}>Change photo</Text>
            </Pressable>
          )}

          <Pressable
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>Submit Application</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Back</Text>
        </Pressable>
        <Text style={s.title}>Discount Card</Text>
        <View style={s.emptyState}>
          <Text style={s.emptyTitle}>No Discount Card</Text>
          <Text style={s.emptyDesc}>
            Apply for a Senior Citizen, PWD, or Student discount card to get 20% off on fares.
          </Text>
        </View>
        <Pressable style={s.applyBtn} onPress={() => setShowForm(true)}>
          <Text style={s.applyBtnText}>Apply for Discount Card</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  backBtn: { marginBottom: 8 },
  backBtnText: { color: '#3b82f6', fontSize: 15 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  statusCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2, gap: 8 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4 },
  statusBadgeText: { fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  cardType: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  validText: { fontSize: 14, fontWeight: '600' },
  dateRow: { gap: 4, alignItems: 'center' },
  dateMeta: { fontSize: 12, color: '#64748b' },
  infoBox: { marginTop: 16, backgroundColor: '#fef3c7', borderRadius: 12, padding: 14 },
  infoText: { color: '#92400e', fontSize: 13 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  cancelText: { color: '#3b82f6', fontSize: 15 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  chipRow: { gap: 8, marginBottom: 20 },
  chip: { borderRadius: 12, padding: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#f0fdf4', borderColor: '#16a34a' },
  chipText: { fontSize: 14, fontWeight: '700', color: '#374151' },
  chipTextActive: { color: '#16a34a' },
  chipDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  chipDescActive: { color: '#64748b' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 15, color: '#0f172a', backgroundColor: '#fff' },
  photoBtn: { borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', minHeight: 100 },
  photoBtnText: { color: '#94a3b8', fontSize: 14 },
  photoPreview: { width: '100%', height: 150, borderRadius: 8, resizeMode: 'cover' },
  changePhotoLink: { alignItems: 'center', marginTop: 8 },
  changePhotoText: { color: '#3b82f6', fontSize: 13 },
  submitBtn: { marginTop: 24, backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyState: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  applyBtn: { backgroundColor: '#16a34a', borderRadius: 14, padding: 16, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
