import type { Client, ClientWithStats } from '@/lib/api';

/** The list hands the tapped client to the card screen (no single-client endpoint is used by the app). */
const cache = new Map<string, Client | ClientWithStats>();
export const clientKey = (c: Client | ClientWithStats) => String(c.id ?? (c as ClientWithStats).clientKey ?? '');
export function rememberClients(list: (Client | ClientWithStats)[]) { for (const c of list) cache.set(clientKey(c), c); }
export const recallClient = (key: string) => cache.get(key);
