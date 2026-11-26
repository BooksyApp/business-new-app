function resolveBase(): string {
  const env = process.env.EXPO_PUBLIC_API_BASE;
  const base = (typeof env === 'string' && env.trim() ? env.trim() : 'https://new-business.getbooqi.tech').replace(/\/+$/, '');
  return base.endsWith('/api') ? base.slice(0, -4) : base;
}
/** Origin without `/api` (the client adds it). Override with EXPO_PUBLIC_API_BASE. */
export const API_BASE = resolveBase();
