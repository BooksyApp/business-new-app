// Regenerates src/assets/mapStyle.tuned.json: fetches the OpenFreeMap "positron" style and applies the booqi palette (src/lib/mapStyleTune.ts).
// Run from apps/mobile: node scripts/build-map-style.mjs   (node >= 22.6 runs the .ts import directly)
import { writeFileSync } from 'node:fs';
import { tuneStyle } from '../src/lib/mapStyleTune.ts';

const res = await fetch('https://tiles.openfreemap.org/styles/positron');
if (!res.ok) throw new Error(`positron style: HTTP ${res.status}`);
const out = new URL('../src/assets/mapStyle.tuned.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(tuneStyle(await res.json()))}\n`);
console.log('wrote', out.pathname);
