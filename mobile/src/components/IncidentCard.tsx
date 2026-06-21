import { View, Text, StyleSheet } from 'react-native';
import type { Incident } from '@/types/incidents';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  INVESTIGATING: '#3b82f6',
  TICKET_ISSUED: '#8b5cf6',
  RESOLVED: '#16a34a',
  DISMISSED: '#64748b',
};

interface Props {
  incident: Incident;
}

export default function IncidentCard({ incident }: Props) {
  const color = STATUS_COLORS[incident.status] ?? '#64748b';

  return (
    <View style={s.card}>
      <View style={s.top}>
        <Text style={s.type}>{incident.incidentType.replace(/_/g, ' ')}</Text>
        <View style={[s.badge, { backgroundColor: color + '22' }]}>
          <Text style={[s.badgeText, { color }]}>{incident.status}</Text>
        </View>
      </View>
      <Text style={s.desc} numberOfLines={2}>{incident.description}</Text>
      <Text style={s.location}>{incident.location}</Text>
      {incident.plateNumber ? <Text style={s.plate}>{incident.plateNumber}</Text> : null}
      <Text style={s.date}>{new Date(incident.incidentDate).toLocaleDateString('en-PH')}</Text>
      {incident.ticketNumber ? (
        <Text style={s.ticket}>Ticket #{incident.ticketNumber}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  type: { fontWeight: '700', color: '#0f172a', fontSize: 14 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  desc: { color: '#64748b', fontSize: 13 },
  location: { color: '#94a3b8', fontSize: 12 },
  plate: { fontWeight: '800', color: '#0f172a', letterSpacing: 1, fontSize: 13 },
  date: { color: '#94a3b8', fontSize: 11 },
  ticket: { color: '#8b5cf6', fontSize: 12, fontWeight: '600' },
});
