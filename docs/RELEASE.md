# Mobile release runbook — production Android APK

How to cut a production build of Basey FareCheck for Android and hand it to
users as a direct download. There is no Google Play submission and no iOS
build; if either becomes a requirement, see [Changing the target](#changing-the-target).

## What the production profile does

`eas.json` → `build.production`:

| Setting | Value | Why |
|---|---|---|
| `environment` | `production` | Pinned explicitly. Without it EAS infers the environment from `distribution`, and `internal` infers `preview` — a silent mismatch once any variable is scoped to only one environment. |
| `distribution` | `internal` | Makes EAS publish a shareable install page + QR for the APK. `store` would be for Play. |
| `android.buildType` | `apk` | Sideloadable. Play would require `app-bundle`. |
| `autoIncrement` | `true` | With `cli.appVersionSource: "remote"`, EAS owns `versionCode`. This is why `app.json` deliberately has no `android.versionCode` — do not add one. |

`EXPO_PUBLIC_API_BASE_URL` is set in the profile's own `env` block and points at
the production web app. Every service reads it as
`process.env.EXPO_PUBLIC_API_BASE_URL ?? ''`, so a missing value fails *silently*
as relative-path fetches rather than erroring — a login that hangs forever in a
built APK almost always means this variable did not reach the bundle.

Note `eas.json` starts with a UTF-8 BOM. Preserve it, or strip it deliberately;
don't let an editor change it as a side effect of an unrelated edit.

## The Google Maps key — the part that bites

`app.config.js` injects `process.env.GOOGLE_MAPS_API_KEY` into
`android.config.googleMaps.apiKey` at build time, so the key never lands in git.
`.easignore` excludes `.env` from the upload, which means **a cloud build cannot
read your local `.env`**. The key must exist as an EAS variable:

```bash
npx eas-cli@latest env:list --environment production
```

If it is missing:

```bash
npx eas-cli@latest env:create --name GOOGLE_MAPS_API_KEY --value <key> \
  --visibility sensitive --scope project \
  --environment production --environment preview --environment development
```

Keep exactly **one** variable with this name. Two same-named variables in the
same environment are accepted by the server, and which one the builder injects
is not something the config can tell you — a stale duplicate silently ships a
dead key. `env:delete` matches by name and cannot disambiguate; the deprecated
`secret:delete --id <uuid>` can, and the IDs come from `env:list --format long`.

Getting the key into the build is only half of it. **The key is restricted by
SHA-1 certificate fingerprint**, and the EAS-managed release keystore has a
different fingerprint than any local debug keystore. Until the release
fingerprint is allowlisted in Google Cloud, maps render grey even though the key
is present and correct.

### Reading the release SHA-1

`eas credentials` is fully interactive, which makes it awkward to script. Two
non-interactive routes:

1. Expo dashboard → project → Credentials → Android → the build keystore.
2. Straight out of the signed APK, no Java required:

```bash
unzip -p app.apk 'META-INF/*.RSA' \
  | openssl pkcs7 -inform DER -print_certs \
  | openssl x509 -noout -fingerprint -sha1
```

(If the APK is signed with a `.EC` or `.DSA` block instead, adjust the glob.)

Then in Google Cloud Console → the Maps Android key → **Application
restrictions → Android apps**, add the pair:

- package name: `com.basey.farecheck`
- SHA-1: the fingerprint above

and confirm **API restrictions** include *Maps SDK for Android*.

## Cutting a release

1. **Gates.** `npm run type-check` and `npm test` must both pass. They are the
   only automated checks this repo has.
2. **Commit everything.** EAS archives the git working copy; the build page
   records the commit it built. An uncommitted tree makes the release
   unreproducible.
3. **Build.**
   ```bash
   npx eas-cli@latest build --platform android --profile production
   ```
   Add `--non-interactive --no-wait` to queue it without blocking on prompts.
4. **Verify on a physical device** (below).
5. Share the install link from the build page.

### Author identity

GitHub rejects pushes from this repo's history if commits carry a private email
(`GH007: Your push would publish a private email address`). All history uses
`68327351+geanzie@users.noreply.github.com`. If `git config user.email` drifts to
a personal address, either fix the config or commit with an inline override:

```bash
git -c user.email="68327351+geanzie@users.noreply.github.com" \
    -c user.name="Gener Ocena" commit ...
```

## Device verification checklist

Install the APK and check, in this order — the ordering matters because an early
failure explains the later ones:

1. **Maps render, not grey** (`InteractiveCalculatorMap`, `RouteMapView`). Grey
   means the key is missing from the build or the SHA-1 is not allowlisted.
2. **Login succeeds** — proves `EXPO_PUBLIC_API_BASE_URL` reached the bundle.
3. **Social sign-in.** A standalone build is the *only* way to exercise this:
   `getOAuthRedirectUri()` resolves to `baseyfare://oauth`, and the server
   allowlists the `baseyfare:` scheme unconditionally, whereas Expo Go's `exp://`
   is refused off development with `oauth_bad_redirect`. Seeing that error in a
   built APK means `scheme` in `app.json` drifted from the server allowlist in
   `frontend/src/lib/oauth/state.ts`.
4. **Camera** (QR terminal scan) and **location** permission prompts.
5. **Fare calculation end-to-end**, including the offline path in
   `src/lib/offline/`. No fare may be shown from a guessed distance.
6. **Idle logout.** Production sets no `EXPO_PUBLIC_AUTH_IDLE_TIMEOUT_MS`, so
   `src/store/authStore.ts` falls back to 15 minutes. The `preview` profile
   overrides it to 10 seconds, which is the practical way to test this.

## No over-the-air updates

`expo-updates` is not installed and no `runtimeVersion` or channel is configured.
Every fix requires a new build and a re-install by each user. If that becomes
painful — likely, since there is no store auto-update either — adding OTA is
`npx expo install expo-updates`, a `runtimeVersion` policy in `app.json`, a
`channel` per eas.json profile, and `eas update:configure`. Retrofitting channels
after users are on an existing build is more awkward than doing it up front.

## Changing the target

- **Google Play**: `android.buildType` must become `app-bundle`, `distribution`
  must become `store` (which also restores `production` environment inference),
  and `submit.production` — currently `{}` — needs a service account JSON and a
  track.
- **iOS**: needs a paid Apple Developer account, an App Store Connect record,
  and `ascAppId` / `appleTeamId` in `submit`. Also note `expo-image-picker` is
  installed but absent from `app.json` `plugins`, so no
  `NSPhotoLibraryUsageDescription` would be generated.

## Known cosmetic gaps

- `assets/logo.png` (2000×2000) serves as icon, splash, *and* Android adaptive
  foreground. Android's circular mask crops the outer ~33%, so an edge-to-edge
  logo gets clipped; a padded variant fixes it.
- `app.json` requests `RECORD_AUDIO` but no audio-recording code exists. Harmless
  while Play is out of scope, but it makes the install prompt scarier than needed.
- `expo-splash-screen` is installed but not listed in `plugins`.
