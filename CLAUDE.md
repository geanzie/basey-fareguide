# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Mobile client for **Basey FareCheck** — the fare standardization system for Basey Municipality, Samar (Philippines) under Municipal Ordinance 105 Series of 2023.

This directory is its own git repo, but it lives inside the parent Basey FareCheck workspace. It has **no backend of its own**: it calls the REST API served by the Next.js web app in `../frontend/` (routes under `frontend/src/app/api/`). The parent `../CLAUDE.md` documents that side — fare formula, role guards, database, routing providers.

Domain concepts (user roles, fare rules, permits, incidents) are defined by the backend. When something here looks wrong, check the API route in `../frontend/` before changing the mobile code.

## Commands

```bash
npx expo start            # dev server (scan QR with Expo Go)
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator
npm run type-check        # tsc --noEmit
npm test                  # Jest test suite
```

## Stack

- **Expo ~54** + **React Native 0.81** + **TypeScript** (strict)
- **Expo Router ~6** — file-based routing, typed routes enabled
- **Zustand ^5** — state management
- **expo-secure-store** — token persistence
- **expo-web-browser** — the system-browser leg of social sign-in
- **@react-native-async-storage/async-storage** — the rider's recent places (`src/lib/recentPlaces.ts`) and the offline copy of the Place list (`src/services/locations.ts`)
- **react-native-maps**, **expo-camera**, **expo-location**, **expo-image-picker**, **react-native-qrcode-svg** — native modules
- **Jest** with the `jest-expo` preset
- **Path alias**: `@/*` → `src/*`

## Architecture

### Routing (`app/`)
File-based with Expo Router. Entry point `app/index.tsx` reads auth state and redirects:
- Unauthenticated → `/login`
- `PUBLIC` → `/public`, `ADMIN` → `/admin`, `DATA_ENCODER` → `/encoder`, `ENFORCER` → `/enforcer`, `DRIVER` → `/driver`

Each role has a `_layout.tsx` with tab navigation. Auth screens sit at root level (`login`, `register`, `register-social`, `forgot-password`, `reset-password`, `change-password`).

Screens per role:
- `public/` — calculator, fare-rates, discount, ordinance, history, report, profile
- `admin/` — users, fare-rates, discount-cards, announcements, incidents, reports, storage, ticket-payments, settings, profile
- `encoder/` — vehicles, permits, ticket-payments, profile
- `enforcer/` — incidents, profile
- `driver/` — history, incidents, profile

`app/_layout.tsx` wraps everything in `SafeAreaProvider` + `FeedbackProvider`, restores the session before hiding the splash screen, and wires the `AppState` listener that drives the idle timeout.

### State (`src/store/`)
- **authStore.ts** — `user`, `token`, `status` (`loading|authenticated|unauthenticated`). Restores the session from SecureStore on startup (5s timeout). Call `setSession(user, token)` on login, `clearSession()` on logout.

  Session expiry is enforced client-side without a network round-trip: `restoreSession` and `enforceIdleTimeout` both log out when the JWT is past its `exp` **or** when the app has been backgrounded longer than the idle timeout. `noteBackground()` stamps the leave time on background; `enforceIdleTimeout()` checks it on foreground. Timeout is `EXPO_PUBLIC_AUTH_IDLE_TIMEOUT_MS`, defaulting to 15 minutes.
- **terminalUnlockStore.ts** — in-memory QR terminal unlock token with server-managed expiry.

### API Layer (`src/services/`)
`api.ts` wraps `fetch`: injects `Authorization: Bearer <token>` from authStore, handles 401 by clearing the session, injects `x-terminal-unlock-token` header when set. All other services call through `api.get/post/put/patch/delete`.

Services: `announcements`, `auth`, `fare`, `incidents`, `locations`, `oauth`, `permits`, `rides`, `terminal`, `vehicles`.

Backend URL: `EXPO_PUBLIC_API_BASE_URL` from `.env` (copy `.env.example`).

### Social sign-in (`src/services/oauth.ts`)
There is no native Google SDK and no client secret in the app. `startSocialSignIn` opens the web app's own `/api/auth/oauth/<slug>/start` in the system browser via `WebBrowser.openAuthSessionAsync`, passing `getOAuthRedirectUri()` (`Linking.createURL('oauth')`) as the redirect — `baseyfare://oauth` in a build, `exp://…/--/oauth` under Expo Go. The browser has its own cookie jar, so the server's httpOnly PKCE/state cookie survives the round trip and the entire web flow is reused.

**Expo Go cannot complete a social sign-in against a deployed server** unless that server names the exact Metro origin in `OAUTH_DEV_REDIRECT_ORIGINS`; `exp://` is otherwise refused off development with a 400 `oauth_bad_redirect`. A dev or preview build works against production unchanged. `fetchOAuthProviders` sends the redirect along and reads `redirectSupported` back, so `login.tsx` disables the social buttons with an explanation instead of opening a browser tab that dead-ends on JSON the app cannot parse.

The server answers on that deep link with `?ticket=` (exchange it at `/api/auth/oauth/native/exchange` for `{ user, token }`), `?signup=` (a first-time user — push `/register-social`, which collects what Google cannot supply and posts the ticket in the body of `/api/auth/oauth/complete`), or `?error=<code>` (map it with `src/lib/oauthErrors.ts`). The login screen renders one button per entry from `/api/auth/oauth/providers`, so a provider the server has no credentials for shows no button.

`src/lib/registrationOptions.ts` holds `BARANGAYS`, `ID_TYPES`, `ID_TYPE_LABELS`, and `PRIVACY_NOTICE_VERSION`, shared by `register` and `register-social`.

### Types (`src/types/`)
Source of truth for API shapes **on this side only** — they are hand-maintained mirrors of `../frontend/src/lib/contracts/`, not generated from it. Changing a contract means updating both repos. `UserRole`: `ADMIN | DATA_ENCODER | ENFORCER | DRIVER | PUBLIC`.

### Auth helpers (`src/lib/`)
`jwt.ts` — dependency-free base64url decode of the JWT payload (`decodeTokenPayload`, `getTokenExpiryMs`, `isTokenExpired`). It does **not** verify signatures; the server remains the authority, so use it only for display or for expiry checks that fail safe — `isTokenExpired` treats an unreadable expiry as expired. `register-social` decodes the sign-up ticket this way purely to greet the user by name.

`oauthErrors.ts` — mirrors `../frontend/src/lib/oauth/errorMessages.ts` so both clients word a refused sign-in the same way.

### UI (`src/ui/`, `src/components/`)
`FeedbackProvider` (wrap root) provides toast feedback. `theme.ts` holds shared tokens.

Primitives (`src/ui/`): `Button`, `Card`, `Badge`, `AppModal`, `SearchBar`, `FilterChips`, `Skeleton`, `EmptyState`, `GradientHeader`, `PasswordInput`, `RowActions`, `StatTile`, `DonutRing`.

Domain components (`src/components/`): `FareResultCard`, `ActiveTripCard`, `IncidentCard`, `PlacePickerField`, `VehiclePickerField`, `InteractiveCalculatorMap`, `RouteMapView`, `QRScannerModal`, `QrComplianceScanModal`, `LoadingScreen`, `OfflineFareNotice`, `TripManifest`.

## Testing

Jest with the `jest-expo` preset; tests live in `src/__tests__/` mirroring `src/`. Current coverage is the service layer and `lib/jwt`. Run a single file with `npx jest src/__tests__/services/fare.test.ts`.

## Environment

Copy `.env.example` → `.env`:
- `EXPO_PUBLIC_API_BASE_URL` — the deployed web app's URL
- `GOOGLE_MAPS_API_KEY` — Android Maps SDK key, restricted by package + SHA-1
- `EXPO_PUBLIC_AUTH_IDLE_TIMEOUT_MS` (optional) — idle logout window, default 15 min

`app.config.js` injects `GOOGLE_MAPS_API_KEY` into the static `app.json` at build time so the key never lands in git. For EAS builds the key must be an EAS environment variable — `.easignore` excludes `.env` from the upload, so a cloud build cannot read your local file. Check with `eas env:list --environment production`. Keep exactly one variable of that name; duplicates are accepted by the server and the builder's choice between them is not observable from config.

## Builds

EAS (`eas.json`), bundle id / package `com.basey.farecheck` for both iOS and Android.
- `development` — dev client, internal distribution
- `preview` — internal APK; points at the production API with a 10s idle timeout for testing expiry
- `production` — internal-distribution APK with `autoIncrement` version, pinned to the `production` EAS environment

Full release procedure, including the Google Maps SHA-1 restriction that decides whether maps render at all, is in [`docs/RELEASE.md`](docs/RELEASE.md).
