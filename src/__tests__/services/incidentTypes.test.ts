import { INCIDENT_TYPES } from '../../../app/public/report';
import type { IncidentType } from '@/types/incidents';

// Backend IncidentType enum (frontend/prisma/schema.prisma). Guards against the
// report screen drifting back to invalid values that the API rejects.
const BACKEND_ENUM: IncidentType[] = [
  'FARE_OVERCHARGE',
  'FARE_UNDERCHARGE',
  'RECKLESS_DRIVING',
  'VEHICLE_VIOLATION',
  'ROUTE_VIOLATION',
  'OTHER',
];

describe('report screen INCIDENT_TYPES', () => {
  it('only uses values present in the backend IncidentType enum', () => {
    for (const t of INCIDENT_TYPES) {
      expect(BACKEND_ENUM).toContain(t.value);
    }
  });

  it('has a non-empty, human-labeled option list', () => {
    expect(INCIDENT_TYPES.length).toBeGreaterThan(0);
    for (const t of INCIDENT_TYPES) {
      expect(t.label.trim().length).toBeGreaterThan(0);
    }
  });
});
