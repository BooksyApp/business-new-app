import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { t as tr } from '@/i18n';
import { getItem, setItem } from '@/lib/secureStorage';
import { api, request } from '@/lib/api';

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

/** Registers the phone's own push token (FCM on Android, APNs on iOS) with the server; the backend sends straight to Firebase / Apple. */
async function register(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  await setupChannels(Notifications);
  const token = await Notifications.getDevicePushTokenAsync();
  const value = typeof token.data === 'string' ? token.data : JSON.stringify(token.data);
  await api.registerDeviceToken(value);
  await setItem(TOKEN_KEY, value);
  return true;
}

/** Explicit opt-in (button on the Notifications tab): the OS prompt follows a choice the user just made. */
export async function enablePush(): Promise<boolean> {
  if (Constants.appOwnership === 'expo') return false;
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return false;
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    return await register();
  } catch {
    return false;
  }
}

const TOKEN_KEY = 'biz.pushToken';

/** Sign-out: this phone stops receiving the signed-out person's alerts (best effort). */
export async function unregisterPush(): Promise<void> {
  try {
    const tok = await getItem(TOKEN_KEY);
    if (tok) await request<void>(`/notifications/device-tokens?token=${encodeURIComponent(tok)}`, { method: 'DELETE' });
  } catch { /* offline: the server drops dead tokens on its own */ }
}

let tokenListener = false;
const ASKED = 'biz.pushAsked';

/** After sign-in: refreshes the token when allowed; the first time, explains in Azerbaijani why and then asks the OS once. */
export async function registerIfGranted(): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) {
      await register();
      if (!tokenListener) { tokenListener = true; Notifications.addPushTokenListener(() => { void register().catch(() => undefined); }); }
      return;
    }
    if (!p.canAskAgain || (await getItem(ASKED))) return;
    await setItem(ASKED, '1');
    Alert.alert(tr('push.title'), tr('push.body'), [
      { text: tr('push.later'), style: 'cancel' },
      { text: tr('push.allow'), onPress: () => { void enablePush(); } },
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
