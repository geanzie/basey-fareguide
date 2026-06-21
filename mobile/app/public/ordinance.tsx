import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SECTIONS = [
  {
    title: 'Overview',
    body:
      'Municipal Ordinance 105, Series of 2023, enacted by the Sangguniang Bayan of Basey, Samar, ' +
      'establishes standardized fare rates for public transportation operating within the municipality. ' +
      'The ordinance covers jeepneys, tricycles, habal-habal, multicabs, buses, and vans.',
  },
  {
    title: 'Base Fare',
    body:
      'The minimum base fare is ₱15.00 covering the first 3 kilometers of travel. ' +
      'For every kilometer or fraction thereof beyond the base distance, an additional ₱3.00 per kilometer applies.',
  },
  {
    title: 'Discounted Fares',
    body:
      'Students, senior citizens, and persons with disabilities (PWD) are entitled to a 20% discount on all ' +
      'public transport fares as mandated by national law and affirmed under this ordinance. ' +
      'Valid identification must be presented upon request.',
  },
  {
    title: 'Covered Vehicles',
    body:
      'All public utility vehicles (PUVs) operating routes within Basey Municipality must comply with the fare schedule:\n' +
      '• Jeepneys\n• Tricycles\n• Habal-habal (motorcycle taxis)\n• Multicabs\n• Buses\n• Vans (UV Express)',
  },
  {
    title: 'Enforcement',
    body:
      'Licensed enforcers appointed by the Municipal Transportation Office are authorized to monitor compliance. ' +
      'Violations including overcharging, undercharging, or refusal to accept discounted fares may result in ' +
      'administrative penalties and suspension of franchise.',
  },
  {
    title: 'Rate Adjustments',
    body:
      'Fare rate adjustments may be made by the Municipal Council through a duly enacted amendatory ordinance. ' +
      'All rate changes take effect only upon official publication and at the scheduled effectivity date.',
  },
  {
    title: 'Complaints',
    body:
      'Passengers who experience overcharging or other violations may report incidents through:\n' +
      '• The Basey FareCheck mobile application (Report tab)\n' +
      '• The Municipal Transportation Office, Basey Samar\n' +
      '• The Sangguniang Bayan of Basey',
  },
];

export default function OrdinanceScreen() {
  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.headerCard}>
          <Text style={s.ordinanceNo}>Municipal Ordinance No. 105</Text>
          <Text style={s.series}>Series of 2023</Text>
          <Text style={s.municipality}>Basey, Samar — Philippines</Text>
          <View style={s.divider} />
          <Text style={s.subtitle}>
            An Ordinance Regulating Fare Rates for Public Utility Vehicles in the Municipality of Basey
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={s.footer}>
          <Text style={s.footerText}>
            This is an informational summary. For the complete text of the ordinance, please contact the Office of the Municipal Secretary, Basey, Samar.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  headerCard: { backgroundColor: '#16a34a', borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  ordinanceNo: { fontSize: 13, fontWeight: '700', color: '#bbf7d0', letterSpacing: 1, textTransform: 'uppercase' },
  series: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 4 },
  municipality: { fontSize: 13, color: '#bbf7d0', marginTop: 4 },
  divider: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, marginVertical: 14 },
  subtitle: { fontSize: 13, color: '#f0fdf4', textAlign: 'center', lineHeight: 20 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  sectionBody: { fontSize: 14, color: '#374151', lineHeight: 22 },
  footer: { backgroundColor: '#fef3c7', borderRadius: 12, padding: 16, marginTop: 6 },
  footerText: { fontSize: 12, color: '#92400e', lineHeight: 18, textAlign: 'center' },
});
