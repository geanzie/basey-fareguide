import { UserType } from '@prisma/client'

import type { AuthUser } from '@/lib/auth'

interface IncidentEvidencePolicyIncident {
  reportedById: string | null
  handledById: string | null
}

export const INCIDENT_EVIDENCE_READ_ACCESS_DENIED_MESSAGE =
  'You can only view evidence for incidents you reported or incidents assigned to you.'

export const INCIDENT_EVIDENCE_REVIEW_ACCESS_DENIED_MESSAGE =
  'Only the assigned enforcer for this incident can review its evidence.'

export function canReadIncidentEvidence(
  incident: IncidentEvidencePolicyIncident,
  user: AuthUser,
): boolean {
  if (user.userType === UserType.ADMIN) {
    return true
  }

  return incident.reportedById === user.id || incident.handledById === user.id
}

export function canReviewIncidentEvidence(
  incident: IncidentEvidencePolicyIncident,
  user: AuthUser,
): boolean {
  return user.userType === UserType.ENFORCER && incident.handledById === user.id
}