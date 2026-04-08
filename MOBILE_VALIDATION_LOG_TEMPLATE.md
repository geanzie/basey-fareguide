# Mobile Validation Log Template

Updated: 2026-04-08

Use this file together with [MOBILE_MANUAL_VERIFICATION_CHECKLIST.md](./MOBILE_MANUAL_VERIFICATION_CHECKLIST.md).

This log is the gate for the next implementation pass.

## Rules

1. Test on a real phone before logging a UI issue.
2. Record only confirmed issues.
3. Use one row per failure.
4. Do not propose fixes in this file. Record evidence only.
5. After fixes, update the retest status instead of deleting the row.

## Severity Guide

- `high`: blocks the task, hides a critical control, or makes the route unreliable on mobile.
- `medium`: task still works, but the screen feels broken, cramped, or misleading.
- `low`: polish issue that does not block task completion.

## Device Sessions

| Session ID | Device | OS | Browser | Navigation Mode | Tester | Date | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| session-001 |  |  |  |  |  |  |  |

## Failure Log

| ID | Route | Role | Device | Trigger | Expected Behavior | Actual Behavior | Severity | Retest Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| issue-001 | `/calculator` | `PUBLIC` | `Android` | `keyboard open after selecting route input` | `CTA remains visible and usable` | `CTA hidden behind bottom nav` | `high` | `not retested` |  |

## Role Coverage

### PUBLIC

- Tested routes:
- Failures found:
- Blockers remaining:

### ADMIN

- Tested routes:
- Failures found:
- Blockers remaining:

### DATA_ENCODER

- Tested routes:
- Failures found:
- Blockers remaining:

### ENFORCER

- Tested routes:
- Failures found:
- Blockers remaining:

## Retest Status Values

- `not retested`
- `fixed`
- `partially fixed`
- `still failing`

## Suggested Execution Order

1. Run the checklist for `PUBLIC` first, starting with `/calculator`, `/dashboard`, `/history`, and `/profile`.
2. Run `ADMIN` next, starting with `/admin/incidents` and `/admin/reports`.
3. Run `DATA_ENCODER` next, focusing on `/encoder/vehicles`.
4. Run `ENFORCER` last, focusing on `/enforcer` and all modal-heavy incident actions.
5. After logging failures, fix only the confirmed issues.
6. Rerun only failed routes first, then do one short global shell regression pass.

## Copy-Paste Single Issue Format

Use this format when sending findings back into chat:

`ROLE /route / device / trigger / expected behavior / actual behavior / severity`

Example:

`PUBLIC /calculator / Android gesture nav / open route input and focus field / primary action remains visible / bottom nav covers action area / high`