import bundled from '@/assets/mapStyle.tuned.json';
import { MAP_PAL, tuneStyle, type StyleJson } from '@/lib/mapStyleTune';

/** Same style the customer site loads (OpenFreeMap "positron"). */
export const POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';
/** Land colour: the map view paints it behind the tiles so nothing ever flashes black while the style or tiles load. */
export const MAP_BG = MAP_PAL.land;

let cached: StyleJson = bundled as unknown as StyleJson;
let refresh: Promise<void> | null = null;

/**
 * The tuned map style, always available synchronously (bundled copy, so the map renders at once and offline). The first call also fetches
 * the live Positron JSON in the background, tunes it and keeps it in memory for maps opened afterwards; an open map is never restyled.
 */
export function mapStyle(): StyleJson {
  refresh ??= fetch(POSITRON_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`style ${r.status}`))))
    .then((j: unknown) => { if (j && typeof j === 'object' && Array.isArray((j as StyleJson).layers)) cached = tuneStyle(j as StyleJson); })
    .catch(() => { refresh = null; /* keep the bundled copy; retry on the next map */ });
  return cached;
}
