import { request } from '@/lib/api';
import { isDemo } from '@/demo';

/** Map pin of a salon. Backend fields on POST /businesses and PUT /businesses/{id}: `latitude`, `longitude` (Double). A salon without both never shows on the customer map. */
export type Pin = { latitude: number; longitude: number };
/** What the reverse lookup knows about a spot; every part is optional. */
export type PinMeta = { address?: string; city?: string; state?: string; zip?: string; country?: string };
export type PinResult = Pin & PinMeta;
/** Default view: Baku centre. */
export const BAKU: Pin = { latitude: 40.4093, longitude: 49.8671 };

export const validPin = (p: { latitude?: unknown; longitude?: unknown } | null | undefined): p is Pin =>
  !!p && typeof p.latitude === 'number' && typeof p.longitude === 'number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && !(p.latitude === 0 && p.longitude === 0);
/** Server rows give numbers, strings or null. */
export const pinOf = (b: { latitude?: unknown; longitude?: unknown } | null | undefined): Pin | null => {
  if (b?.latitude == null || b?.longitude == null) return null;
  const p = { latitude: Number(b.latitude), longitude: Number(b.longitude) };
  return validPin(p) ? p : null;
};
export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

type Raw = { display_name?: string; lat?: string; lon?: string; address?: Record<string, string> };
export type Place = PinResult & { label: string };

function parts(a: Record<string, string> | undefined, display?: string): PinMeta {
  if (!a) return { address: display?.split(',').slice(0, 2).join(',').trim() || undefined };
  const street = [a.road || a.pedestrian || a.neighbourhood || a.suburb, a.house_number].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.municipality || a.city_district || a.county || a.state || undefined;
  return { address: street || undefined, city, state: a.state || a.region || a.county || undefined, zip: a.postcode || undefined, country: a.country || undefined };
}

const DEMO_PLACES: Place[] = [
  { label: 'Nizami küç., Bakı', address: 'Nizami küç. 52', city: 'Bakı', latitude: 40.3795, longitude: 49.8483 },
  { label: 'Dənizkənarı Milli Park, Bakı', address: 'Dənizkənarı bulvar', city: 'Bakı', latitude: 40.3722, longitude: 49.8531 },
  { label: 'Əhmədli, Bakı', address: 'Əhmədli', city: 'Bakı', latitude: 40.3836, longitude: 49.9486 },
  { label: 'Gəncə, Azərbaycan', address: 'Nizami küç.', city: 'Gəncə', latitude: 40.6828, longitude: 46.3606 },
];

export const geo = {
  /** GET /api/public/geocode?q= (backend Nominatim proxy). Empty on failure so typing never throws. */
  search: async (q: string): Promise<Place[]> => {
    const s = q.trim();
    if (s.length < 3) return [];
    if (isDemo()) return DEMO_PLACES.filter((p) => p.label.toLowerCase().includes(s.toLowerCase()));
    const rows = await request<Raw[] | null>(`/public/geocode?q=${encodeURIComponent(s)}`, { auth: false }).catch(() => null);
    return (Array.isArray(rows) ? rows : []).map((r) => ({ latitude: Number(r.lat), longitude: Number(r.lon), label: r.display_name ?? '', ...parts(r.address, r.display_name) })).filter((p) => validPin(p));
  },
  /** GET /api/public/geocode/reverse?lat=&lon=. null when the lookup is unavailable (503): the person types the address by hand. */
  reverse: async (p: Pin): Promise<PinMeta | null> => {
    if (isDemo()) return { address: 'Nizami küç. 52', city: 'Bakı', state: 'Bakı', zip: 'AZ1000', country: 'Azərbaycan' };
    const r = await request<Raw | null>(`/public/geocode/reverse?lat=${p.latitude}&lon=${p.longitude}`, { auth: false }).catch(() => null);
    return r && (r.address || r.display_name) ? parts(r.address, r.display_name) : null;
  },
};
