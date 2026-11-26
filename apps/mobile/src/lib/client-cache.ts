import type { Client, ClientWithStats } from '@/lib/api';

/** The list hands the tapped client to the card screen (no single-client endpoint is used by the app). */
const cache = new Map<string, Client | ClientWithStats>();
export const clientKey = (c: Client | ClientWithStats) => String(c.id ?? (c as ClientWithStats).clientKey ?? '');
export function rememberClients(list: (Client | ClientWithStats)[]) { for (const c of list) cache.set(clientKey(c), c); }
export const recallClient = (key: string) => cache.get(key);
/** Best match for a typed name / phone among the clients seen so far (waitlist "book now" preselects the client). */
export function findClient(name?: string | null, phone?: string | null): Client | ClientWithStats | undefined {
  const n = (name ?? '').trim().toLowerCase();
  const p = (phone ?? '').replace(/\D/g, '');
  for (const c of cache.values()) {
    const full = `${c.firstName} ${c.lastName ?? ''}`.trim().toLowerCase();
    if ((p && c.phone && c.phone.replace(/\D/g, '') === p) || (n && full === n)) return c;
  }
  return undefined;
}
