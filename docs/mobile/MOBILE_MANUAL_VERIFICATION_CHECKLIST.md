# Mobile Manual Verification Checklist

Updated: 2026-04-12

## Goal

Validate the new authenticated mobile shell and page-level fit changes on real devices before adding more behavior.

This checklist is for:

- bottom navigation validation
- profile sheet validation
- high-risk screen usability
- safe-area and gesture-bar validation
- desktop regression confirmation

## Build And Environment Notes

- Preferred app build signal: `npx next build`
- `npm run type-check` should remain green before manual testing.
- `npm run test` still has unrelated environment-sensitive failures and should not be used as the only release gate for this mobile pass.
- `npm run build` may still fail on Windows/OneDrive because Prisma cannot rename its engine DLL during `prisma generate`. Treat that as a separate release-confidence issue, not a UI failure.

## Device Matrix

Run at least these combinations:

1. Android phone with gesture navigation enabled.
2. Android phone with classic navigation buttons if available.
3. iPhone or iOS simulator with a bottom safe-area inset.
4. Narrow viewport around 360px width.
5. Medium mobile viewport around 390px to 430px width.
6. Desktop viewport at `lg` and above to confirm sidebar preservation.

## Global Shell Checks

Run these checks for every authenticated role:

1. The hamburger is gone on mobile.
2. The mobile bottom nav is always reachable and not clipped.
3. The active tab state follows route changes correctly.
4. The profile sheet opens quickly, closes cleanly, and does not leave the page scroll-locked after closing.
5. The profile sheet content is not hidden behind the gesture bar or bottom inset.
6. Tapping outside the sheet closes it.
7. Navigating from the profile sheet closes the sheet.
8. Logging out from the profile sheet still works.
9. Mobile page titles remain short and do not wrap awkwardly.
10. Desktop `lg` and above still shows the sidebar and does not show the bottom nav.

## Public Role Checks

### Dashboard

Route: `/dashboard`

1. Hero card, action cards, and recent activity cards fit without clipped bottom spacing.
2. Action cards have comfortable tap targets and do not feel crowded.
3. Empty states, if shown, are not too low on the page and do not collide with the bottom nav.
4. Links to calculator, report, history, and discount card still feel obvious.

### Calculator / Map

Route: `/calculator`

1. The map is the first major surface on mobile.
2. The map is visible without excessive scrolling.
3. Bottom nav does not cover the map surface.
4. Bottom nav does not cover route summary cards.
5. Bottom nav does not cover map helper text or fallback messages.
6. Map controls, markers, and drag interactions remain usable near the lower edge.
7. The result card remains readable after a route is calculated.
8. Fare details disclosure is reachable and not clipped.
9. Scroll behavior remains stable after route calculation.
10. Safe-area behavior looks correct on gesture-bar devices.
11. If any mobile keyboard appears during real-device use, confirm it does not cover essential controls. If it does, record the exact trigger before adding keyboard-aware shell behavior.

### History

Route: `/history`

1. Filter chips remain tappable without crowding.
2. Search field is usable on a narrow phone width.
3. Timeline items and empty states have enough spacing above the bottom nav.
4. No summary row or pagination control is clipped.

### Profile

Route: `/profile`

1. The page does not feel like it has a duplicate title stacked under the shell header.
2. Edit, Save, and Cancel actions remain visible and easy to tap.
3. Form fields have enough vertical spacing when editing.
4. The bottom nav does not compete with the final form fields or account status card.

## Admin Role Checks

### Admin Incidents

Route: `/admin/incidents`

1. Search and filter controls wrap cleanly on mobile.
2. The mobile card presentation is readable and not cramped.
3. Status chips remain legible.
4. Empty states do not collapse too low near the bottom nav.
5. Desktop still renders the larger table layout correctly.

### Admin Reports

Route: `/admin/reports`

1. Period selector and export button stack cleanly on mobile.
2. Analytics cards do not feel too dense on small screens.
3. Long metric labels do not break the layout.
4. Bottom spacing remains correct at the end of the report.

## Data Encoder Checks

### Vehicle Registry

Route: `/encoder/vehicles`

1. The header action remains clear on mobile and does not crowd the page title area.
2. Filters stack properly and remain easy to use.
3. Stats cards remain readable without truncation issues that hide meaning.
4. Pagination controls are reachable and not clipped by the bottom nav.
5. Desktop still shows the full table behavior correctly.

## Enforcer Checks

### Incident Queue

Route: `/enforcer`

1. Queue summary does not duplicate the shell title awkwardly.
2. Search and filter controls wrap cleanly.
3. Row actions remain tappable.
4. Incident detail modal fits inside the viewport on mobile.
5. Ticket modal respects bottom safe-area spacing.
6. Modal action buttons stack well and do not sit behind the gesture bar.
7. Closing a modal returns the page to a normal scroll state.

### QR Compliance Terminal

Launcher surface available from authenticated enforcer routes.

1. The floating QR launcher stays above the mobile safe area and does not collide with bottom navigation.
2. Password-entry state stays content-sized and does not jump immediately to a full-height shell.
3. Camera state stays content-sized while the live scanner is active.
4. No duplicate camera preview surface appears when the scanner starts.
5. Manual-entry content can scroll to the final action without clipping.
6. Result content can scroll when vehicle/compliance details are taller than the viewport.
7. Opening `History` replaces the active content pane instead of overlaying the camera surface.
8. The history list scrolls cleanly to the last visible entry without clipping the final card.
9. On the smallest mobile widths, the top control row remains reachable and does not wrap awkwardly.

## Desktop Regression Checks

Run these after mobile validation:

1. Sidebar still appears from `lg` upward.
2. Bottom nav is hidden on desktop widths.
3. Profile dropdown in the desktop header still works.
4. No page has unexpected extra bottom padding on desktop.
5. Table-heavy admin and encoder screens still use desktop layouts correctly.

## Sign-Off Criteria

This mobile pass is ready for sign-off when:

1. All role shells pass the global checks.
2. The calculator route feels natural on a real phone and shows no overlap issues.
3. Modal-heavy enforcer flows remain usable on mobile.
4. Admin and encoder data screens remain readable on small screens.
5. Desktop navigation behavior remains intact.

## Follow-Up Rule

Do not add hide-on-keyboard or other viewport-aware behavior unless manual testing identifies a real blocked interaction, with the exact screen and trigger documented.