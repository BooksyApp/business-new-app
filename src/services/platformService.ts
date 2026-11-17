import { useEffect, useState } from 'react';

import { API_BASE_URL } from '@/config/api';
import { getLocale } from '@/i18n';

/**
 * The platform switches the back office sets.
 *
 * The endpoint has always been served and nothing read it, so closing business signups or
 * turning on an announcement changed a row in a table and nothing in any client.
 */
export interface PlatformSettings {
  /** Online card payments; off in the MVP, so deposits are recorded but never taken. */
  stripe?: { enabled?: boolean };
  appMaintenance: boolean;
  appMaintenanceMessage: string;
  minAppVersion: string;
  webMaintenance: boolean;
  webMaintenanceMessage: string;
  announcement: string;
  customerSignupsOpen: boolean;
  businessSignupsOpen: boolean;
  defaultMap: { lat: number; lng: number; zoom: number };
  countries: PlatformCountry[];
  /** Online card payments live for this deployment (same flag the web reads). v1: false. */
  onlinePayments?: boolean;
  /** Support WhatsApp number; absent until the platform configures one. */
  supportWhatsapp?: string;
  /** A-06: support address ops set in the admin; absent/empty until configured. */
  supportEmail?: string;
  /** Which features the platform has switched on for this panel. */
  flags: Record<string, boolean>;
}

export interface PlatformCountry {
  code: string;
  name: string;
  currency: string;
  dial_code?: string | null;
  center_lat?: number | null;
  center_lng?: number | null;
  default_zoom?: number | null;
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
  flags: {},
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

/**
 * The flags, cached for the life of the tab.
 *
 * Every screen wants the same answer and it does not change while somebody is working a
 * shift, so one request serves the whole session. Anything the platform did not mention
 * keeps the behaviour the panel shipped with — a network failure must not remove features
 * from a salon mid-shift.
 */
let cached: Promise<PlatformSettings> | null = null;

export function platformSettings(): Promise<PlatformSettings> {
  if (!cached) cached = getPlatformSettings();
  return cached;
}

export function useFeatureFlags(): Record<string, boolean> {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let live = true;
    platformSettings().then((settings) => {
      if (live) setFlags(settings.flags ?? {});
    });
    return () => {
      live = false;
    };
  }, []);
  return flags;
}

/**
 * A-06: where "Support" goes. The admin's support address as a mailto, or the public support
 * page until one is configured — never a hard-coded address.
 */
export function useSupportHref(fallback: string): string {
  const [href, setHref] = useState(fallback);
  useEffect(() => {
    let live = true;
    platformSettings().then((s) => {
      const email = String(s.supportEmail ?? '').trim();
      if (live && email) setHref(`mailto:${email}?subject=booqi%20for%20business`);
    });
    return () => {
      live = false;
    };
  }, []);
  return href;
}

/** Where the panel is being used: dial code and map centre come from the country row. */
export interface Market {
  country: string;
  dialCode: string;
  center: { lat: number; lng: number; zoom: number };
}

const LOCALE_COUNTRY: Record<string, string> = { az: 'AZ', pl: 'PL' };
const LAUNCH_COUNTRY = 'AZ';

async function geoCountry(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/geo`);
    if (!res.ok) return null;
    const body = (await res.json()) as { country?: string | null; active?: boolean };
    return body.active && body.country ? body.country.toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * The market to default to: the business's own country when it has one, else the visitor's
 * (IP geo), else the one their panel language implies, else the launch market. Never a
 * hardcoded country: the dial code and map centre come from the platform's country rows.
 */
export async function resolveMarket(businessCountry?: string | null): Promise<Market | null> {
  const settings = await platformSettings();
  const countries = settings.countries ?? [];
  const find = (code?: string | null) => (code ? countries.find((c) => c.code.toUpperCase() === code.toUpperCase()) : undefined);
  const row =
    find(businessCountry) ??
    find(await geoCountry()) ??
    find(LOCALE_COUNTRY[getLocale()]) ??
    find(LAUNCH_COUNTRY) ??
    countries[0];
  if (!row) return null;
  return {
    country: row.code,
    dialCode: row.dial_code || '',
    center: {
      lat: row.center_lat ?? settings.defaultMap.lat,
      lng: row.center_lng ?? settings.defaultMap.lng,
      zoom: Math.max(row.default_zoom ?? 12, 11),
    },
  };
}

export function useMarket(businessCountry?: string | null): Market | null {
  const [market, setMarket] = useState<Market | null>(null);
  useEffect(() => {
    let live = true;
    resolveMarket(businessCountry).then((m) => {
      if (live) setMarket(m);
    });
    return () => {
      live = false;
    };
  }, [businessCountry]);
  return market;
}

/** True when online card payments are live. False while loading or when the platform has them off. */
export function useOnlinePayments(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    platformSettings().then((s) => {
      if (live) setOn(s.onlinePayments === true);
    });
    return () => {
      live = false;
    };
  }, []);
  return on;
}

/** FG-W1-03: this salon's support channel (admin-set WhatsApp/e-mail) and İlk 100 priority. */
export interface SalonSupport {
  whatsapp: string;
  email: string;
  priority: boolean;
}

export async function getSalonSupport(businessId: string): Promise<SalonSupport | null> {
  try {
    const { apiClient } = await import("@/config/api");
    return await apiClient.get<SalonSupport>(`/businesses/${businessId}/support`);
  } catch {
    return null;
  }
}
