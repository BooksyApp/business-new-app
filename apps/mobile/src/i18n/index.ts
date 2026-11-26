import { NativeModules, Platform } from 'react-native';

import { getItem, setItem } from '../lib/secureStorage';
import { az } from './az';
import { en, type Strings } from './en';
import { ru } from './ru';

/**
 * Language: AZ default, EN, RU. No library (same approach as customer-app).
 * Unlike customer-app the locale is switchable live: `setLocale` notifies subscribers and
 * the root remounts the tree keyed by the locale, so module-level string capture is not a problem
 * as long as strings are read through `t()` at render time.
 */
const LOCALE_KEY = 'booqi.biz.locale';

export const SUPPORTED = [
  { code: 'az', endonym: 'Azərbaycanca' },
  { code: 'en', endonym: 'English' },
  { code: 'ru', endonym: 'Русский' },
] as const;
export type LocaleCode = (typeof SUPPORTED)[number]['code'];

const TABLES: Record<LocaleCode, unknown> = { az, en, ru };
let current: LocaleCode = 'az';
const listeners = new Set<(c: LocaleCode) => void>();

function isLocale(v: unknown): v is LocaleCode {
  return SUPPORTED.some((l) => l.code === v);
}

export function getLocale(): LocaleCode {
  return current;
}

export function subscribeLocale(fn: (c: LocaleCode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadLocale(): Promise<LocaleCode> {
  const saved = await getItem(LOCALE_KEY);
  if (isLocale(saved)) current = saved;
  return current;
}

export async function setLocale(code: LocaleCode): Promise<void> {
  current = code;
  await setItem(LOCALE_KEY, code);
  listeners.forEach((fn) => fn(code));
}

function lookup(source: unknown, path: string[]): unknown {
  let node: unknown = source;
  for (const key of path) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type StringKey = Leaves<Strings>;

/** One string; `{{name}}` placeholders are filled from params; English is the fallback. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  const path = key.split('.');
  const translated = lookup(TABLES[current], path);
  const value = typeof translated === 'string' ? translated : lookup(en, path);
  if (typeof value !== 'string') return key;
  if (!params) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    params[name] == null ? whole : String(params[name]),
  );
}

export function intlLocale(): string {
  return current === 'az' ? 'az-AZ' : current === 'ru' ? 'ru-RU' : 'en-GB';
}

/** Device locale, only used for reference/diagnostics. */
export function deviceLocale(): string {
  try {
    if (Platform.OS === 'ios') {
      const s = NativeModules.SettingsManager?.settings;
      return s?.AppleLocale ?? s?.AppleLanguages?.[0] ?? 'az';
    }
    return NativeModules.I18nManager?.localeIdentifier ?? 'az';
  } catch {
    return 'az';
  }
}
