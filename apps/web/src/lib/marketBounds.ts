/**
 * LR-15: rough bounding boxes of the markets booqi operates in, used only when the reverse
 * geocoder cannot say which country a pin is in. The geocoder's country code is the real
 * check; the box is the fallback (it is generous at the borders on purpose).
 */
const MARKET_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  AZ: { minLat: 38.39, maxLat: 41.91, minLng: 44.76, maxLng: 50.95 },
};

/** True when a pin at lat/lng is outside `market`; false when it cannot be told. */
export function pinOutsideMarket(
  market: string | null | undefined,
  lat: number,
  lng: number,
  geocodedCountryCode?: string | null
): boolean {
  if (!market) return false;
  const home = market.toUpperCase();
  if (geocodedCountryCode) return geocodedCountryCode.toUpperCase() !== home;
  const b = MARKET_BOUNDS[home];
  if (!b) return false;
  return lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng;
}
