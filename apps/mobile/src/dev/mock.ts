/**
 * DEV ONLY visual-QA layer. Loaded from app/_layout.tsx only when __DEV__ && EXPO_PUBLIC_MOCK=1 (web preview).
 * Uses the same demo engine as the release "Demo-ya bax" (src/demo): pins the clock to the artifact's 10:12 and boots
 * straight into the demo salon. ?signedout=1 keeps the sign-in screen, ?mock=empty|error|slow switches the data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { installDemoFetch, setDemoVariant } from '@/demo';

export function install() {
  // Dev preview clock: 10:12 (the artifact frames show 10:12, next client 10:30).
  { const R = Date; const t0 = new R(); t0.setHours(10, 12, 0, 0); const off = t0.getTime() - R.now();
    class MockDate extends R { constructor(...a: unknown[]) { if (a.length === 0) super(R.now() + off); else super(...(a as [number])); } static now() { return R.now() + off; } }
    (globalThis as { Date: DateConstructor }).Date = MockDate as unknown as DateConstructor; }
  installDemoFetch();
  const search = typeof location !== 'undefined' ? location.search : '';
  const v = /mock=(\w+)/.exec(search)?.[1] ?? '';
  setDemoVariant(v === 'empty' || v === 'error' || v === 'slow' || v === 'live' ? v : '');
  const out = /signedout/.test(search);
  (globalThis as { __BOOQI_AUTODEMO__?: boolean }).__BOOQI_AUTODEMO__ = !out;
  if (out) void AsyncStorage.clear();
}
