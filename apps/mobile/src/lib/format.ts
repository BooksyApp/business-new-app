import { getLocale, intlLocale } from '@/i18n';

// Azerbaijani names are fixed tables: Intl 'az' data is missing on some runtimes (it printed "M11" / "Mon"), and the product is AZ-first.
const AZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const AZ_MONTHS_S = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
const AZ_DAYS_S = ['B.', 'B.e', 'Ç.a', 'Çər', 'C.a', 'Cümə', 'Şnb']; // getDay(): Sun first
const AZ_DAYS_L = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
const az = () => getLocale() === 'az';
export const weekdayLong = (d: Date) => (az() ? AZ_DAYS_L[d.getDay()] : new Intl.DateTimeFormat(intlLocale(), { weekday: 'long' }).format(d));

/** "09:00:00" -> "09:00". */
export const hhmm = (s: string | undefined | null) => (s ?? '').slice(0, 5);

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
