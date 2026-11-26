import React, { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { OfflineBanner, Screen, Skeleton, StateView } from '@/components/ui';
import { routeOf } from '@/lib/push';
import { subscribeLocale, t as tr } from '@/i18n';
import { AppProvider, useApp } from '@/lib/app';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

function Shell() {
  const { t } = useTheme();
  const { status, retryBoot } = useApp();
  const router = useRouter();
  // A tapped push notification opens its booking (or the alerts tab) once the user is signed in.
  useEffect(() => {
    if (status !== 'in') return;
    const go = (r: Notifications.NotificationResponse | null) => { if (r) router.push(routeOf(r.notification.request.content.data) as never); };
    go(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
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
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="salons" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="booking/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="section/[key]" />
          <Stack.Screen name="booking/[id]" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function Root() {
  const [ok] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const [locale, setLocale] = useState(0);
  useEffect(() => subscribeLocale(() => setLocale((n) => n + 1)), []);
  if (!ok) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            {/* Remount on language change so every string is re-read through t(). */}
            <Shell key={locale} />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
