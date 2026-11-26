import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * "Gəldi" (client arrived) marker. The booking API has no arrived state between CONFIRMED and COMPLETED, so the app keeps
 * a per-device list of arrived booking ids (kept 2 days). It only drives the status timeline and which CTA a booking shows.
 */
const KEY = 'booqi.biz.arrived.v1';
let ids = new Map<string, number>();
const subs = new Set<() => void>();
let loaded = false;
async function load() {
  if (loaded) return; loaded = true;
  try { const raw = await AsyncStorage.getItem(KEY); if (raw) ids = new Map(JSON.parse(raw) as [string, number][]); } catch { /* fresh */ }
  const cut = Date.now() - 2 * 864e5; for (const [k, v] of ids) if (v < cut) ids.delete(k);
  subs.forEach((f) => f());
}
export function markArrived(id: string) {
  ids.set(String(id), Date.now());
  AsyncStorage.setItem(KEY, JSON.stringify([...ids])).catch(() => {});
  subs.forEach((f) => f());
}
export const isArrived = (id: string) => ids.has(String(id));
/** Re-renders when the arrived set changes. */
export function useArrived() {
  const [, set] = useState(0);
  useEffect(() => { void load(); const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return isArrived;
}
