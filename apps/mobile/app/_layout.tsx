import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Opening } from '@/components/Opening';
import { ToastHost } from '@/components/ToastHost';
import { OfflineBanner, Screen, Skeleton, StateView } from '@/components/ui';
import { loadNotifications, routeOf } from '@/lib/push';
import { CrashScreen, installGlobalHandler, RootErrorBoundary } from '@/lib/crash';
import { subscribeLocale, t as tr } from '@/i18n';
import { AppProvider, useApp } from '@/lib/app';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

import { installDemoFetch } from '@/demo';

// Demo mode ("Demo-ya bax") answers API calls locally while it is on; a pass-through otherwise. Works in release builds.
installDemoFetch();
// DEV-only visual QA: boots into the demo salon with the clock pinned (never in release: __DEV__ is false there).
if (__DEV__ && process.env.EXPO_PUBLIC_MOCK === '1') { try { require('@/dev/mock').install(); } catch (e) { console.error('mock install failed', e); } }
installGlobalHandler();
try { SplashScreen.preventAutoHideAsync().catch(() => {}); } catch { /* ignore */ }
// Hard cap: the splash never outlives 4s, whatever fonts / session / network do.
setTimeout(() => { try { SplashScreen.hideAsync().catch(() => {}); } catch { /* ignore */ } }, 4000);
try {
  loadNotifications()?.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
} catch { /* push is optional */ }

/** expo-router renders this for errors thrown inside any route. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return <CrashScreen error={error} onRetry={() => { void retry(); }} />;
}

function Shell() {
  const { t } = useTheme();
  const { status, retryBoot } = useApp();
  const router = useRouter();
  // A tapped push notification opens its booking (or the alerts tab) once the user is signed in.
  useEffect(() => {
    if (status !== 'in') return;
    const N = loadNotifications();
    if (!N) return;
    try {
      const go = (r: { notification: { request: { content: { data?: unknown } } } } | null) => { if (r) router.push(routeOf(r.notification.request.content.data) as never); };
      go(N.getLastNotificationResponse());
      const sub = N.addNotificationResponseReceivedListener(go);
      return () => sub.remove();
    } catch { return; }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (status !== 'boot') SplashScreen.hideAsync().catch(() => {}); }, [status]);
  if (status === 'boot') return <Screen><Skeleton rows={6} /></Screen>;
  if (status === 'offline') return <Screen><StateView icon="wifioff" title={tr('state.offlineTitle')} body={tr('state.offlineBody')} actionLabel={tr('state.retry')} onAction={retryBoot} /></Screen>;
  const signedIn = status === 'in';
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas }, animation: 'slide_from_right', gestureEnabled: true, animationDuration: 260 }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot" />
          <Stack.Screen name="accept-invite" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="salons" />
          <Stack.Screen name="create-business" />
          <Stack.Screen name="bookings" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="booking/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="booking/classic" />
          <Stack.Screen name="section/[key]" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="post-stats/[id]" />
          <Stack.Screen name="story/view" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="story/create" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function Root() {
  const [loaded, fontError] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const [locale, setLocale] = useState(0);
  useEffect(() => subscribeLocale(() => setLocale((n) => n + 1)), []);
  // Fonts failing or taking >3s must not hold the app hostage: fall back to system fonts.
  const [fontWait, setFontWait] = useState(true);
  useEffect(() => { const id = setTimeout(() => setFontWait(false), 3000); return () => clearTimeout(id); }, []);
  if (!loaded && !fontError && fontWait) return null;
  return (
    <RootErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            {/* Remount on language change so every string is re-read through t(). */}
            <Shell key={locale} />
            <Opening />
            <ToastHost />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}
