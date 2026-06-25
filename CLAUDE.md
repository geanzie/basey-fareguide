# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start            # dev server (scan QR with Expo Go)
npx expo start --android  # Android emulator
npx expo start --ios      # iOS simulator
npm run type-check        # tsc --noEmit
npm test                  # Jest test suite
```

## Stack

- **Expo ~54** + **React Native** + **TypeScript** (strict)
- **Expo Router ~6** — file-based routing, typed routes enabled
- **Zustand ^5** — state management
- **expo-secure-store** — token persistence
- **Path alias**: `@/*` → `src/*`

## Architecture

### Routing (`app/`)
File-based with Expo Router. Entry point `app/index.tsx` reads auth state and redirects:
- Unauthenticated → `/login`
- `PUBLIC` → `/public`, `ADMIN` → `/admin`, `DATA_ENCODER` → `/encoder`, `ENFORCER` → `/enforcer`, `DRIVER` → `/driver`

Each role has a `_layout.tsx` with tab navigation. Auth screens at root level (`login`, `register`, `forgot-password`, `reset-password`).

### State (`src/store/`)
- **authStore.ts** — `user`, `token`, `status` (`loading|authenticated|unauthenticated`). Restores session from SecureStore on startup (5s timeout). Call `setSession(user, token)` on login, `clearSession()` on logout.
- **terminalUnlockStore.ts** — in-memory QR terminal unlock token with server-managed expiry.

### API Layer (`src/services/`)
`api.ts` wraps `fetch`: injects `Authorization: Bearer <token>` from authStore, handles 401 by clearing session, injects `x-terminal-unlock-token` header when set. All other services call through `api.get/post/put/patch/delete`.

Backend URL: `EXPO_PUBLIC_API_BASE_URL` from `.env` (copy `.env.example`).

### Types (`src/types/`)
Source of truth for API shapes. `UserRole`: `ADMIN | DATA_ENCODER | ENFORCER | DRIVER | PUBLIC`.

### UI (`src/ui/`, `src/components/`)
`FeedbackProvider` (wrap root) provides toast feedback. Reusable components: `Button`, `Card`, `Badge`, `AppModal`, `SearchBar`, `FilterChips`, `Skeleton`, `FareResultCard`, `QRScannerModal`, `QrComplianceScanModal`.

## Environment

Copy `.env.example` → `.env`, set `EXPO_PUBLIC_API_BASE_URL` to backend URL.
