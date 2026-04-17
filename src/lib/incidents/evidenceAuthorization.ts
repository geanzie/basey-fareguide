import { UserType } from '@prisma/client'

import type { AuthUser } from '@/lib/auth'

interface IncidentEvidencePolicyIncident {
  reportedById: string | null
  handledById?: string | null
}

export const INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE =
  'You can only view evidence for incidents you reported, or if you are an enforcer or admin.'

export const INCIDENT_EVIDENCE_REVIEW_ACCESS_DENIED_MESSAGE =
  'Only enforcers can verify incident evidence.'

export function canReadIncidentEvidence(
  incident: IncidentEvidencePolicyIncident,
  user: AuthUser,
): boolean {
  if (user.userType === UserType.ADMIN) {
    return true
  }

  if (user.userType === UserType.ENFORCER) {
    return true
  }

  return incident.reportedById === user.id
}

export function canReviewIncidentEvidence(
  _incident: IncidentEvidencePolicyIncident,
  user: AuthUser,
): boolean {
  return user.userType === UserType.ENFORCER
}