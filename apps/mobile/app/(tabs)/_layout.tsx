import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Platform, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { useApp } from '@/lib/app';
import { DOCK_HEIGHT, DOCK_SIDE, dockBottom } from '@/lib/dock';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const ITEMS = [
  { name: 'calendar', icon: 'cal', k: 'tabs.calendar' }, { name: 'clients', icon: 'users', k: 'tabs.clients' },
  { name: 'notifications', icon: 'bell', k: 'tabs.notifications' }, { name: 'more', icon: 'dots', k: 'tabs.more' },
] as const;

/**
 * Floating glass dock, 1:1 with `.dock` / `.tab` of biz-ui.css (BF01): 70 tall, 20 from the sides, padding 7, pill radius, white 66% + blur 22;
 * four equal tabs (icon 23 over a 14/600 label, letter-spacing -.02em, gap 1); the active tab is a surface pill in --vtext.
 */
function TabBar({ state, navigation }: any) {
  const { t } = useTheme(); const ins = useSafeAreaInsets();
  const bot = dockBottom(ins.bottom);
  const base = t.dark ? 'rgba(30,26,42,.66)' : 'rgba(255,255,255,.66)';
  const solid = t.dark ? 'rgba(30,26,42,.95)' : 'rgba(255,255,255,.95)'; // Android: no per-frame blur, near-opaque keeps 60fps
  const line = t.dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.75)';
  const sh = '0 22px 44px -16px rgba(29,23,48,.42), 0 2px 6px rgba(29,23,48,.06)';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={t.dark ? ['rgba(20,17,29,0)', 'rgba(20,17,29,.9)'] : ['rgba(251,247,242,0)', 'rgba(251,247,242,.9)']} locations={[0, 0.7]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 + Math.max(0, bot - 18) }} />
      <View style={{ marginHorizontal: DOCK_SIDE, marginBottom: bot, height: DOCK_HEIGHT, borderRadius: 999, boxShadow: sh } as any}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999, overflow: 'hidden', backgroundColor: Platform.OS === 'android' ? solid : 'transparent', borderWidth: 1, borderColor: line }}>
          {Platform.OS !== 'android' && <><BlurView intensity={70} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} /></>}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', padding: 7 }}>
          {ITEMS.map((it, i) => {
            const route = state.routes[i]; const on = state.index === i;
            const col = on ? t.vtext : t.muted;
            return (
              <RNPressable key={it.name} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tr(it.k)} android_ripple={null}
                onPress={() => {
                  const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!on && !ev.defaultPrevented) { Haptics.selectionAsync().catch(() => {}); navigation.navigate(route.name); }
                }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, borderRadius: 999, backgroundColor: on ? t.surface : 'transparent', ...(on ? { boxShadow: '0 6px 16px -8px rgba(29,23,48,.35)' } : null) } as any}>
                <Icon name={it.icon} filled={on} size={23} color={col} />
                <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, letterSpacing: -0.28, color: col }}>{tr(it.k)}</Text>
              </RNPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { salon } = useApp();
  if (!salon) return <Redirect href="/salons" />;
  // lazy mount on first visit, then stay mounted (state preserved); no unmount on blur.
  return <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, lazy: true, animation: 'none' }}>{ITEMS.map((i) => <Tabs.Screen key={i.name} name={i.name} />)}</Tabs>;
}
