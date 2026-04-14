# Frontend Documentation

This folder holds frontend-specific documentation that is still useful during development and validation.

## Directories

- `mobile/` for mobile validation checklists and evidence logs.
- `email/` for email setup, integration, and reset-testing notes.
- `data/` for frontend data-source integration summaries.

## Current Workflow References

- `../../docs/guides/QR_COMPLIANCE_TERMINAL_GUIDE.md` for the encoder and enforcer QR workflow.
- `../../docs/features/QR_COMPLIANCE_TERMINAL_TESTING_GUIDE.md` for the focused automated and manual validation path.
- `mobile/MOBILE_MANUAL_VERIFICATION_CHECKLIST.md` now includes QR Compliance Terminal mobile checks.

## Admin Fare Management

- Fare-rate management remains versioned and append-first for normal publish or schedule operations.
- Admins can now revert the live fare to the previous eligible version. Eligibility is limited to non-canceled versions with an `effectiveAt` earlier than the current live version, ordered by latest `effectiveAt` and then latest `createdAt`.
- Admins can permanently delete mistaken upcoming or historical fare versions, but the current live fare version remains non-deletable.
- Permanent delete is audited through a dedicated fare deletion audit record that captures the deleted fare version id, admin actor, timestamp, and deletion reason/action.

## Docs Kept Near Code

- `src/data/BASEY_LOCATIONS_USAGE.md`
- `scripts/LOCATIONS_README.md`