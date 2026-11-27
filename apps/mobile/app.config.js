// Same as app.json; for the visual-QA web preview (EXPO_PUBLIC_MOCK=1) native-only plugins that are not installed locally are dropped.
const base = require('./app.json');
module.exports = () => {
  const cfg = base.expo;
  // Android map tiles need a Google Maps SDK key (iOS uses Apple Maps, no key). Supplied by the build environment, never committed.
  if (process.env.GOOGLE_MAPS_API_KEY) cfg.android = { ...cfg.android, config: { ...(cfg.android || {}).config, googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } } };
  if (process.env.EXPO_PUBLIC_MOCK !== '1') return cfg;
  return { ...cfg, plugins: (cfg.plugins || []).filter((p) => (Array.isArray(p) ? p[0] : p) !== 'expo-notifications'), web: { bundler: 'metro', output: 'single' } };
};
