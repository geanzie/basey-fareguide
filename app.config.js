// Injects the Android Google Maps key from env so it never lands in git.
// Local dev: set GOOGLE_MAPS_API_KEY in .env (gitignored).
// EAS build: eas secret:create --name GOOGLE_MAPS_API_KEY --value <key>
// `config` is the static app.json, which Expo passes in here.
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
});
