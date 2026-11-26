import { useSyncExternalStore } from 'react';

/** Reachability as seen by the API client: one failed network call flips it off, the next answered call flips it back on. */
let online = true;
const subs = new Set<() => void>();
export function setOnline(v: boolean) {
  if (v === online) return;
  online = v;
  subs.forEach((f) => f());
}
export function useOnline(): boolean {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => online, () => true);
}
