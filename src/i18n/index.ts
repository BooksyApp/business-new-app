/**
 * Tiny typed i18n layer — no dependency. See ./README.md.
 *
 *   t("calendar.title")                          -> "Calendar"
 *   t("clients.count", { count: 3 })             -> "3 clients"   (plural via ICU-lite)
 *   t("common.hello", { name: "Aysel" })         -> "Hello, Aysel"
 *
 * `t` reads the active locale at call time. The provider remounts the tree when the locale
 * changes, so plain `t(...)` calls in render are always current. Lookup order: active
 * locale -> en -> the key itself (with a console.warn in dev only).
 */
import en from "./locales/en.json";
import az from "./locales/az.json";
import { getHubLocale, type HubLocale } from "@/lib/hubLocale";
import { formatDate, formatNumber } from "./format";

type Tree = { [k: string]: string | Tree };
type Join<K extends string, P extends string> = `${K}.${P}`;
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>>;
}[keyof T & string];

/** Every key present in en.json, as a dotted path. */
export type TKey = Paths<typeof en>;
export type TParams = Record<string, string | number | boolean | null | undefined>;

// en (fallback) and az (default panel language) ship in the main bundle; ru (~200 kB of
// JSON) is its own chunk, loaded before first render only for a panel set to Russian
// (main.tsx) or when someone switches to it (I18nProvider). Until it lands, t() falls back
// to en like any missing key.
const DICTS: Partial<Record<HubLocale, Tree>> = { en: en as Tree, az: az as Tree };
const LAZY: Partial<Record<HubLocale, () => Promise<{ default: unknown }>>> = {
  ru: () => import("./locales/ru.json"),
};
const flatCache = new Map<HubLocale, Map<string, string>>();

export function isHubLocaleLoaded(locale: HubLocale): boolean {
  return DICTS[locale] !== undefined;
}

/** Loads a lazily bundled locale; resolves at once for one already loaded (or on failure). */
export async function loadHubLocale(locale: HubLocale): Promise<void> {
  const load = LAZY[locale];
  if (DICTS[locale] || !load) return;
  try {
    DICTS[locale] = (await load()).default as Tree;
    flatCache.delete(locale);
  } catch {
    /* offline / chunk missing: keep falling back to en */
  }
}

function flat(locale: HubLocale): Map<string, string> {
  let m = flatCache.get(locale);
  if (m) return m;
  m = new Map();
  const dict = DICTS[locale];
  if (!dict) return m; // not loaded yet: not cached, so it is built once the chunk arrives
  const walk = (node: Tree, prefix: string) => {
    for (const [k, v] of Object.entries(node)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") m!.set(p, v);
      else walk(v, p);
    }
  };
  walk(dict, "");
  flatCache.set(locale, m);
  return m;
}

function pluralCategory(locale: HubLocale, n: number): string {
  if (locale === "az") return n === 1 ? "one" : "other"; // Chrome lacks az plural data
  return new Intl.PluralRules(locale).select(n);
}

/** Index of the "}" matching the "{" at `open`. */
function closeBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

/** ICU-lite: "{name}" and "{count, plural, =0 {none} one {# item} other {# items}}". */
function format(msg: string, params: TParams | undefined, locale: HubLocale): string {
  if (!msg.includes("{")) return msg;
  let out = "";
  let i = 0;
  while (i < msg.length) {
    const open = msg.indexOf("{", i);
    if (open < 0) {
      out += msg.slice(i);
      break;
    }
    out += msg.slice(i, open);
    const close = closeBrace(msg, open);
    if (close < 0) {
      out += msg.slice(open);
      break;
    }
    const inner = msg.slice(open + 1, close);
    const m = /^\s*([\w.]+)\s*,\s*plural\s*,/.exec(inner);
    if (m) {
      const n = Number(params?.[m[1]] ?? 0);
      const body = inner.slice(m[0].length);
      const forms = new Map<string, string>();
      const re = /\s*(=\d+|\w+)\s*\{/g;
      let pos = 0;
      for (let r = re.exec(body); r && r.index === pos; r = re.exec(body)) {
        const o = r.index + r[0].length - 1;
        const c = closeBrace(body, o);
        if (c < 0) break;
        forms.set(r[1], body.slice(o + 1, c));
        pos = c + 1;
        re.lastIndex = pos;
      }
      const chosen = forms.get(`=${n}`) ?? forms.get(pluralCategory(locale, n)) ?? forms.get("other") ?? "";
      out += format(chosen.replace(/#/g, formatNumber(locale, n)), params, locale);
    } else {
      const v = params?.[inner.trim()];
      out += v == null || typeof v === "boolean" ? "" : String(v);
    }
    i = close + 1;
  }
  return out;
}

export function translate(locale: HubLocale, key: string, params?: TParams): string {
  let msg = flat(locale).get(key);
  if (msg === undefined) {
    msg = flat("en").get(key);
    if (import.meta.env.DEV && msg === undefined) console.warn(`[i18n] missing key "${key}"`);
  }
  return format(msg ?? key, params, locale);
}

/** Translate with the active locale. */
export function t(key: TKey, params?: TParams): string {
  return translate(getHubLocale(), key, params);
}

/** For keys built at runtime (e.g. `status.${s}`); not type-checked, falls back to `fallback`. */
export function tDynamic(key: string, fallback?: string, params?: TParams): string {
  const loc = getHubLocale();
  if (!flat(loc).has(key) && !flat("en").has(key)) return fallback ?? key;
  return translate(loc, key, params);
}

/**
 * Label for a stored option value (a survey answer, a refund reason...) whose English text is
 * also the value sent to the API: translated via `opt.<group>.<slug>`, falling back to the value.
 */
export function tOpt(group: string, value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return tDynamic(`opt.${group}.${slug}`, value);
}

/** "30 min" / "1 h" / "1 h 30 min" in the panel language (az: "30 dəq", "1 saat 30 dəq"). */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return t("common.durationHourMin", { h, m });
  if (h > 0) return t("common.durationHour", { h });
  return t("common.durationMin", { m });
}

export function getLocale(): HubLocale {
  return getHubLocale();
}

/** Active-locale date / number formatting (see ./format.ts). */
export const fmtDate = (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => formatDate(getHubLocale(), d, opts);
export const fmtNumber = (n: number, opts?: Intl.NumberFormatOptions) => formatNumber(getHubLocale(), n, opts);

export { formatDate, formatNumber };
export type { HubLocale };
