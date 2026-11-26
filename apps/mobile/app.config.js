// Same as app.json; for the visual-QA web preview (EXPO_PUBLIC_MOCK=1) native-only plugins that are not installed locally are dropped.
const base = require('./app.json');
module.exports = () => {
  const cfg = base.expo;
  if (process.env.EXPO_PUBLIC_MOCK !== '1') return cfg;
  return { ...cfg, plugins: (cfg.plugins || []).filter((p) => (Array.isArray(p) ? p[0] : p) !== 'expo-notifications'), web: { bundler: 'metro', output: 'single' } };
};
