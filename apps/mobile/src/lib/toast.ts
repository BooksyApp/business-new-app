type Kind = 'success' | 'error' | 'info';
export type ToastMsg = { id: number; text: string; kind: Kind };
/** Native modals (BottomSheet, fullScreenModal screens) cover the root ToastHost; while one is open its own host shows the toast instead. */
export const modalCount = { n: 0 };
const subs = new Set<(m: ToastMsg | null) => void>();
let seq = 0;
/** Fire-and-forget toast (replaces blocking Alert dialogs for success / error feedback). */
export function toast(text: string, kind: Kind = 'info') {
  const m = { id: ++seq, text, kind };
  subs.forEach((f) => f(m));
}
export function subscribeToast(f: (m: ToastMsg | null) => void) { subs.add(f); return () => { subs.delete(f); }; }
