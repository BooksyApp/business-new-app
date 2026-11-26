import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/lib/api';

async function register(): Promise<boolean> {
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
