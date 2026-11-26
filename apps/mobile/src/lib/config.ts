function resolveBase(): string {
  const env = process.env.EXPO_PUBLIC_API_BASE;
  const base = (typeof env === 'string' && env.trim() ? env.trim() : 'https://new-business.getbooqi.tech').replace(/\/+$/, '');
  return base.endsWith('/api') ? base.slice(0, -4) : base;
}
/** Origin without `/api` (the client adds it). Override with EXPO_PUBLIC_API_BASE. */
export const API_BASE = resolveBase();

/** The public site (legal pages, salon share link). Override with EXPO_PUBLIC_WEB_BASE. */
export const WEB_BASE = ((typeof process.env.EXPO_PUBLIC_WEB_BASE === 'string' && process.env.EXPO_PUBLIC_WEB_BASE.trim()) || 'https://getbooqi.tech').replace(/\/+$/, '');
/** Wording version of the terms the owner ticks at sign-up (same as customer-new-app web lib/legal.ts; pages are /legal/terms|privacy|cookies). */
export const TERMS_VERSION = '2026-11-16';

/** The salon's public booking page as the hub hands it out: `<site>/salon/<slug|id>`, tagged ?src=link so booqi knows the salon brought the booking itself. */
export function salonShareLink(s: unknown, src: 'link' | 'qr' = 'link'): string {
  const b = s as { slug?: string; id?: string | number } | null;
  return `${WEB_BASE}/salon/${b?.slug ?? String(b?.id ?? '')}?src=${src}`;
}
