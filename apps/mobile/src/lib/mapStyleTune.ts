/**
 * Pure port of `tune()` + `PAL.light` from the customer site (customer-new-app/apps/web/src/lib/spec/livemap.ts): recolours the
 * OpenFreeMap "positron" style into booqi's warm cream map. No imports, so scripts/build-map-style.mjs can run it under plain node.
 */
export const MAP_PAL = { land: '#efe8df', water: '#cfe3ec', park: '#dcead9', road: '#ffffff', roadMinor: '#fbf8f3', casing: '#e3d9cc', label: '#6b6385', halo: '#efe8df', build: '#e7dfd4' } as const;

type Json = Record<string, unknown>;
export type StyleLayer = { id: string; type: string; paint?: Json; layout?: Json; [k: string]: unknown };
export type StyleJson = { layers: StyleLayer[]; [k: string]: unknown };

/** Returns a recoloured deep copy; the input is not modified. Same layer-id patterns, same hidden layers as the web map. */
export function tuneStyle<T extends StyleJson>(style: T): T {
  const c = MAP_PAL;
  const layers = style.layers.map((src): StyleLayer => {
    const l: StyleLayer = { ...src, paint: { ...(src.paint ?? {}) }, layout: { ...(src.layout ?? {}) } };
    const id = l.id;
    const paint = l.paint as Json;
    const hide = () => { (l.layout as Json).visibility = 'none'; };
    if (l.type === 'background') paint['background-color'] = c.land;
    else if (l.type === 'fill') {
      const k = /water/.test(id) ? c.water : /park|wood|grass|landcover/.test(id) && !/ice|glacier/.test(id) ? c.park : /building/.test(id) ? c.build : c.land;
      paint['fill-color'] = k; paint['fill-opacity'] = 1; paint['fill-outline-color'] = k;
    } else if (l.type === 'line') {
      if (/boundary/.test(id)) hide();
      else if (/waterway/.test(id)) paint['line-color'] = c.water;
      else if (/casing/.test(id)) paint['line-color'] = c.casing;
      else if (/railway|aeroway/.test(id)) paint['line-color'] = c.casing;
      else if (/minor|path|service/.test(id)) paint['line-color'] = c.roadMinor;
      else paint['line-color'] = c.road;
    } else if (l.type === 'symbol') {
      if (/shield|airport/.test(id)) hide();
      else { paint['text-color'] = c.label; paint['text-halo-color'] = c.halo; paint['text-halo-width'] = 1.4; }
    }
    if (l.id === 'ne2_shaded') hide();
    return l;
  });
  return { ...style, layers };
}
