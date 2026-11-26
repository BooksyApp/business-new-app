import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

/** Lazy: a broken/missing native push module must never crash app start (import time). */
export function loadNotifications(): typeof import('expo-notifications') | null {
  try { return require('expo-notifications'); } catch { return null; }
}

async function register(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Bookings', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await api.registerDeviceToken(token.data);
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

/** After sign-in: when the OS permission is already granted, send the (possibly rotated) token to the server. Never prompts. */
export async function registerIfGranted(): Promise<void> {
  if (Constants.appOwnership === 'expo') return;
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) await register();
  } catch {
    /* push is best effort */
  }
}

/** Where a tapped notification goes: its `bookingId` data opens that booking, anything else the alerts tab. */
export function routeOf(data: unknown): string {
  const id = data && typeof data === 'object' ? (data as Record<string, unknown>).bookingId : null;
  return typeof id === 'string' || typeof id === 'number' ? `/booking/${String(id)}` : '/notifications';
}
