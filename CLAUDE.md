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
- **react-native-maps**, **expo-camera**, **expo-location**, **expo-image-picker**, **react-native-qrcode-svg** — native modules
- **Jest** with the `jest-expo` preset
- **Path alias**: `@/*` → `src/*`

## Architecture

### Routing (`app/`)
File-based with Expo Router. Entry point `app/index.tsx` reads auth state and redirects:
- Unauthenticated → `/login`
- `PUBLIC` → `/public`, `ADMIN` → `/admin`, `DATA_ENCODER` → `/encoder`, `ENFORCER` → `/enforcer`, `DRIVER` → `/driver`

Each role has a `_layout.tsx` with tab navigation. Auth screens sit at root level (`login`, `register`, `forgot-password`, `reset-password`, `change-password`).

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

Services: `announcements`, `auth`, `fare`, `incidents`, `locations`, `permits`, `rides`, `terminal`, `vehicles`.

Backend URL: `EXPO_PUBLIC_API_BASE_URL` from `.env` (copy `.env.example`).

### Types (`src/types/`)
Source of truth for API shapes **on this side only** — they are hand-maintained mirrors of `../frontend/src/lib/contracts/`, not generated from it. Changing a contract means updating both repos. `UserRole`: `ADMIN | DATA_ENCODER | ENFORCER | DRIVER | PUBLIC`.

### Auth helpers (`src/lib/`)
`jwt.ts` — dependency-free base64url decode of the JWT payload to read `exp`. It does **not** verify signatures; the server remains the authority. `isTokenExpired` fails safe (treats an unreadable expiry as expired).

### UI (`src/ui/`, `src/components/`)
`FeedbackProvider` (wrap root) provides toast feedback. `theme.ts` holds shared tokens.

Primitives (`src/ui/`): `Button`, `Card`, `Badge`, `AppModal`, `SearchBar`, `FilterChips`, `Skeleton`, `EmptyState`, `GradientHeader`, `PasswordInput`, `RowActions`, `StatTile`, `DonutRing`.

Domain components (`src/components/`): `FareResultCard`, `ActiveTripCard`, `IncidentCard`, `LocationSelector`, `VehiclePickerField`, `InteractiveCalculatorMap`, `RouteMapView`, `QRScannerModal`, `QrComplianceScanModal`, `LoadingScreen`.

## Testing

Jest with the `jest-expo` preset; tests live in `src/__tests__/` mirroring `src/`. Current coverage is the service layer and `lib/jwt`. Run a single file with `npx jest src/__tests__/services/fare.test.ts`.

## Environment

Copy `.env.example` → `.env`:
- `EXPO_PUBLIC_API_BASE_URL` — the deployed web app's URL
- `GOOGLE_MAPS_API_KEY` — Android Maps SDK key, restricted by package + SHA-1
- `EXPO_PUBLIC_AUTH_IDLE_TIMEOUT_MS` (optional) — idle logout window, default 15 min

`app.config.js` injects `GOOGLE_MAPS_API_KEY` into the static `app.json` at build time so the key never lands in git. For EAS builds, set it as a secret: `eas secret:create --name GOOGLE_MAPS_API_KEY --value <key>`.

## Builds

EAS (`eas.json`), bundle id / package `com.basey.farecheck` for both iOS and Android.
- `development` — dev client, internal distribution
- `preview` — internal APK; points at the production API with a 10s idle timeout for testing expiry
- `production` — APK with `autoIncrement` version
