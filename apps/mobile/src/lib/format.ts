import { getLocale, intlLocale, t as tr } from '@/i18n';

// Azerbaijani names are fixed tables: Intl 'az' data is missing on some runtimes (it printed "M11" / "Mon"), and the product is AZ-first.
const AZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const AZ_MONTHS_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
const AZ_DAYS_S = ['B.', 'B.e', 'Ç.a', 'Çər', 'C.a', 'Cümə', 'Şnb']; // getDay(): Sun first
const AZ_DAYS_L = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
const az = () => getLocale() === 'az';
export const weekdayLong = (d: Date) => (az() ? AZ_DAYS_L[d.getDay()] : new Intl.DateTimeFormat(intlLocale(), { weekday: 'long' }).format(d));

/** "09:00:00" -> "09:00". */
/** HH:mm from '10:00', '10:00:00' or an ISO datetime; '' when there is none. */
export const hhmm = (s: string | undefined | null) => (s ?? '').match(/(\d{2}):(\d{2})/)?.slice(1, 3).join(':') ?? '';

export const toMin = (s: string) => {
  const [h, m] = hhmm(s).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMin = (n: number) =>
  `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const fromIso = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/**
 * A server timestamp as a Date in device local time. Prefers the absolute instant (ISO with Z); the zone-less
 * LocalDateTime fallback is read as local wall time (old behaviour). Null when neither parses.
 */
export const stampDate = (instant?: string | null, naive?: string | null): Date | null => {
  for (const s of [instant, naive]) {
    if (!s) continue;
    const d = new Date(s.length > 10 && s[10] === ' ' ? `${s.slice(0, 10)}T${s.slice(11)}` : s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

/** Whole calendar days between a yyyy-MM-dd date and today (0 = today), independent of the time of day. */
export const calDaysAgo = (iso: string) => {
  const d = fromIso(iso);
  const n = new Date();
  return Math.max(0, Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - d.getTime()) / 86400000));
};

export const dateLabel = (d: Date) =>
  az() ? `${d.getDate()} ${AZ_MONTHS_S[d.getMonth()]}` : new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);

export const monthLabel = (d: Date) =>
  az() ? `${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}` : new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(d);
export const dayMonth = (d: Date) => (az() ? `${d.getDate()} ${AZ_MONTHS[d.getMonth()].toLowerCase()}` : new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long' }).format(d));

export const weekdayShort = (d: Date) =>
  az() ? AZ_DAYS_S[d.getDay()] : new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' }).format(d);

export function money(n: number | null | undefined, currency = 'AZN') {
  if (n == null) return '—';
  if (az() && currency === 'AZN') return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n).replace(/,/g, ' ')} ₼`;
  try {
    return new Intl.NumberFormat(intlLocale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** Server-written inbox text: raw "2026-11-28 22:00" becomes the app's "28 noy · 22:00", and in AZ "15 AZN" becomes "15 ₼". Anything else is untouched. */
export function readableServerText(s: string) {
  const out = s.replace(/\b(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?\b/g, (_m, d: string, hm: string) => `${dateLabel(fromIso(d))} · ${hm}`);
  return az() ? out.replace(/(\d(?:[\d.,]*\d)?)\s?AZN\b/g, '$1 ₼') : out;
}

/** A service's list price: "30 ₼" (fixed), "30-dan" (FROM, "Başlayaraq") or "30–50 ₼" (RANGE with a maximum). */
export function servicePrice(s: { price?: number | null; priceType?: string | null; priceMax?: number | null }, currency = 'AZN') {
  const lo = money(s.price, currency);
  if (s.price == null) return lo;
  if (s.priceType === 'RANGE' && s.priceMax != null && s.priceMax > s.price) {
    const hi = money(s.priceMax, currency);
    return az() && currency === 'AZN' ? `${lo.replace(/\s₼$/, '')}–${hi}` : `${lo}–${hi}`;
  }
  if (s.priceType === 'FROM') return az() ? `${lo}-dan` : `${tr('sx.from')} ${lo}`;
  return lo;
}

export const initials = (name: string | undefined | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export const digits = (s: string | undefined | null) => (s ?? '').replace(/[^\d]/g, '');

/** Week-strip letters of the v2 calendar (AZ: B.e Ç.a Ç C.a C Ş B). */
const AZ_DAYS_MINI = ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'];
export const weekdayMini = (d: Date) => (az() ? AZ_DAYS_MINI[d.getDay()] : new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow' }).format(d));
