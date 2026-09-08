import { API_BASE_URL } from '@/config/api';

/**
 * The platform switches the back office sets.
 *
 * The endpoint has always been served and nothing read it, so closing business signups or
 * turning on an announcement changed a row in a table and nothing in any client.
 */
export interface PlatformSettings {
  appMaintenance: boolean;
  appMaintenanceMessage: string;
  minAppVersion: string;
  webMaintenance: boolean;
  webMaintenanceMessage: string;
  announcement: string;
  customerSignupsOpen: boolean;
  businessSignupsOpen: boolean;
  defaultMap: { lat: number; lng: number; zoom: number };
  countries: { code: string; name: string; currency: string }[];
}

export const PLATFORM_DEFAULTS: PlatformSettings = {
  appMaintenance: false,
  appMaintenanceMessage: '',
  minAppVersion: '',
  webMaintenance: false,
  webMaintenanceMessage: '',
  announcement: '',
  customerSignupsOpen: true,
  businessSignupsOpen: true,
  defaultMap: { lat: 50.0614, lng: 19.9366, zoom: 12 },
  countries: [],
};

/** Never rejects: a salon mid-shift must not lose its panel because this call failed. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/platform`);
    if (!res.ok) return PLATFORM_DEFAULTS;
    return { ...PLATFORM_DEFAULTS, ...((await res.json()) as Partial<PlatformSettings>) };
  } catch {
    return PLATFORM_DEFAULTS;
  }
}
