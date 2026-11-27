import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { t as tr } from '@/i18n';
import { getItem, setItem, removeItem } from '@/lib/secureStorage';
import { api, request, ApiError } from '@/lib/api';

/** Lazy: a broken/missing native push module must never crash app start (import time). */
export function loadNotifications(): typeof import('expo-notifications') | null {
  try { return require('expo-notifications'); } catch { return null; }
}

/** Android notification channels: bookings (also payments, waitlist), stock, reviews. */
async function setupChannels(N: NonNullable<ReturnType<typeof loadNotifications>>) {
  if (Platform.OS !== 'android') return;
  const mk = (id: string, name: string, imp: number) => N.setNotificationChannelAsync(id, { name, importance: imp, sound: 'default', vibrationPattern: [0, 250, 250, 250] });
  await mk('bookings', 'Rezervlər', N.AndroidImportance.HIGH);
  await mk('stock', 'Anbar', N.AndroidImportance.DEFAULT);
  await mk('reviews', 'Rəylər', N.AndroidImportance.DEFAULT);
}

const TOKEN_KEY = 'biz.pushToken';
const REG_KEY = 'biz.pushReg';
const ASKED = 'biz.pushAsked';
const BACKOFF_MS = [5_000, 30_000, 300_000]; // at most 3 attempts, then give up until the next app start

/** Module-level state: one registration at a time, never a retry storm. */
let activeUser: string | null = null;
let inFlight = false;
let halted = false; // 401/403/429 or retries exhausted: no more attempts this app run
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let tokenSub: { remove: () => void } | null = null;

function stopRetries() { if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } }

/** One registration pass for the active user: skips an unchanged (user, token) pair; retries only on network/5xx. */
async function registerOnce(attempt: number): Promise<void> {
  const userId = activeUser;
  if (!userId || inFlight || halted) return;
  const Notifications = loadNotifications();
  if (!Notifications) return;
  inFlight = true;
  try {
    await setupChannels(Notifications);
    const token = await Notifications.getDevicePushTokenAsync();
    const value = typeof token.data === 'string' ? token.data : JSON.stringify(token.data);
    const key = `${userId}|${value}`;
    if ((await getItem(REG_KEY)) === key) return; // already registered for this person and token
    await api.registerDeviceToken(value);
    await setItem(TOKEN_KEY, value);
    await setItem(REG_KEY, key);
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0;
    // Auth / rate-limit answers never get retried: the refresh flow owns 401, a 429 means stop for this run.
    if (status === 401 || status === 403 || status === 429 || status === 400) { halted = true; return; }
    if (attempt + 1 >= BACKOFF_MS.length) { halted = true; return; }
    stopRetries();
    retryTimer = setTimeout(() => { retryTimer = null; if (activeUser === userId) void registerOnce(attempt + 1); }, BACKOFF_MS[attempt]);
  } finally {
    inFlight = false;
  }
}

/** Explicit opt-in (button on the Notifications tab): the OS prompt follows a choice the user just made. */
export async function enablePush(userId?: string | null): Promise<boolean> {
  if (Constants.appOwnership === 'expo') return false;
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return false;
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    if (userId) { activeUser = String(userId); halted = false; await registerOnce(0); attachListener(Notifications); }
    return true;
  } catch {
    return false;
  }
}

function attachListener(Notifications: NonNullable<ReturnType<typeof loadNotifications>>) {
  if (tokenSub) return;
  // A rotated token re-registers through the same guarded path (unchanged token = no request).
  tokenSub = Notifications.addPushTokenListener(() => { void registerOnce(0); });
}

/** Sign-out: this phone stops receiving the signed-out person's alerts (best effort, once). */
export async function unregisterPush(): Promise<void> {
  stopRetries();
  try { tokenSub?.remove(); } catch { /* ignore */ }
  tokenSub = null;
  activeUser = null; halted = false; inFlight = false;
  try {
    const tok = await getItem(TOKEN_KEY);
    await removeItem(REG_KEY);
    if (tok) { await removeItem(TOKEN_KEY); await request<void>(`/notifications/device-tokens?token=${encodeURIComponent(tok)}`, { method: 'DELETE' }); }
  } catch { /* offline: the server drops dead tokens on its own */ }
}

/** After sign-in: registers when permission is already granted; the first time, explains in Azerbaijani why and then asks the OS once. */
export async function registerIfGranted(userId: string | number): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  const uid = String(userId);
  if (activeUser !== uid) { activeUser = uid; halted = false; stopRetries(); }
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) {
      attachListener(Notifications);
      await registerOnce(0);
      return;
    }
    if (!p.canAskAgain || (await getItem(ASKED))) return;
    await setItem(ASKED, '1');
    Alert.alert(tr('push.title'), tr('push.body'), [
      { text: tr('push.later'), style: 'cancel' },
      { text: tr('push.allow'), onPress: () => { void enablePush(uid); } },
    ]);
  } catch {
    /* push is best effort */
  }
}

/** Where a tapped notification goes: its `bookingId` data opens that booking, anything else the alerts tab. */
export function routeOf(data: unknown): string {
  const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  if (typeof d.route === 'string' && d.route.startsWith('/')) return d.route;
  const id = d.bookingId;
  if (typeof id === 'string' || typeof id === 'number') return `/booking/${String(id)}`;
  if (d.productId != null) return '/section/inventory';
  return '/notifications';
}
