import { intlLocale } from '@/i18n';

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
  new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);

export const monthLabel = (d: Date) =>
  new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' }).format(d);

export const weekdayShort = (d: Date) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' }).format(d);

export function money(n: number | null | undefined, currency = 'AZN') {
  if (n == null) return '—';
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
