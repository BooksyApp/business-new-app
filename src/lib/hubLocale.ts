import { useSyncExternalStore } from "react";

/**
 * The panel's language. One shared store: the Language modal writes here, the i18n layer
 * (src/i18n) and every `useHubLocale()` caller read from the same value. localStorage can
 * be blocked (private mode, policies), so every access is guarded.
 */
export const HUB_LOCALES = [
  { code: "az", name: "Azərbaycanca", subtitle: "Azerbaijani" },
  { code: "en", name: "English", subtitle: "English" },
  { code: "ru", name: "Русский", subtitle: "Russian" },
] as const;

export type HubLocale = (typeof HUB_LOCALES)[number]["code"];

const KEY = "booqi.hub.locale";
/** New users (nothing stored yet) get Azerbaijani. */
export const DEFAULT_HUB_LOCALE: HubLocale = "az";

export function readHubLocale(): HubLocale {
  try {
    const v = localStorage.getItem(KEY);
    if (HUB_LOCALES.some((l) => l.code === v)) return v as HubLocale;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_HUB_LOCALE;
}

let current: HubLocale = readHubLocale();
const listeners = new Set<() => void>();

/** The active locale, readable outside React (used by the global `t`). */
export function getHubLocale(): HubLocale {
  return current;
}

export function setHubLocale(next: string): void {
  if (!HUB_LOCALES.some((l) => l.code === next) || next === current) return;
  current = next as HubLocale;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable: the choice lasts for this session */
  }
  listeners.forEach((l) => l());
}

export function subscribeHubLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useHubLocale() {
  const locale = useSyncExternalStore(subscribeHubLocale, getHubLocale, getHubLocale);
  return [locale, setHubLocale] as const;
}
