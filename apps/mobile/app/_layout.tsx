import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Screen, Skeleton, StateView } from '@/components/ui';
import { subscribeLocale, t as tr } from '@/i18n';
import { AppProvider, useApp } from '@/lib/app';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Shell() {
  const { t } = useTheme();
  const { status, retryBoot } = useApp();
  useEffect(() => { if (status !== 'boot') SplashScreen.hideAsync().catch(() => {}); }, [status]);
  if (status === 'boot') return <Screen><Skeleton rows={6} /></Screen>;
  if (status === 'offline') return <Screen><StateView icon="wifioff" title={tr('state.offlineTitle')} body={tr('state.offlineBody')} actionLabel={tr('state.retry')} onAction={retryBoot} /></Screen>;
  const signedIn = status === 'in';
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.canvas }, animation: 'slide_from_right', gestureEnabled: true, animationDuration: 260 }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="salons" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="section/[key]" />
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
