import React, { memo, useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Platform, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
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
const ICON = 26; const H = 48; const PAD = 9;
const SPRING = { stiffness: 380, damping: 30, mass: 1 };

type Pal = { on: string; off: string; pill: string; pillLine: string; press: string };
const LIGHT: Pal = { on: '#4a2fc4', off: '#352e48', pill: 'rgba(111,82,237,.15)', pillLine: 'rgba(111,82,237,.2)', press: 'rgba(29,23,48,.1)' };
const DARK: Pal = { on: '#ebe5ff', off: '#c4bdd8', pill: 'rgba(160,138,255,.26)', pillLine: 'rgba(190,170,255,.3)', press: 'rgba(255,255,255,.1)' };

/** Floating glass dock (pattern of customer-new-app, artifact F62): icons only; the active tab opens into a violet pill with its label. */
const DockItem = memo(function DockItem({ icon, label, on, pal, idleW, activeW, onPress }: {
  icon: string; label: string; on: boolean; pal: Pal; idleW: number; activeW: number; onPress: () => void;
}) {
  const p = useSharedValue(on ? 1 : 0); const lp = useSharedValue(on ? 1 : 0); const pr = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(on ? 1 : 0, SPRING);
    lp.value = on ? withDelay(140, withTiming(1, { duration: 140 })) : withTiming(0, { duration: 70 });
  }, [on, p, lp]);
  const box = useAnimatedStyle(() => ({ width: interpolate(p.value, [0, 1], [idleW, activeW]), transform: [{ scale: 1 - 0.08 * pr.value }] }));
  const bg = useAnimatedStyle(() => ({ opacity: p.value }));
  const prs = useAnimatedStyle(() => ({ opacity: pr.value * (1 - p.value) }));
  const ic = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 1], [(idleW - ICON) / 2, 14]) }] }));
  const lb = useAnimatedStyle(() => ({ opacity: lp.value, transform: [{ translateX: interpolate(lp.value, [0, 1], [-8, 0]) }] }));
  const col = on ? pal.on : pal.off;
  return (
    <Animated.View style={[{ height: H, borderRadius: H / 2 }, box]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: H / 2, backgroundColor: pal.pill, borderWidth: 1, borderColor: pal.pillLine }, bg]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: H / 2, backgroundColor: pal.press }, prs]} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: (H - ICON) / 2, width: ICON, height: ICON }, ic]}>
        <Icon name={icon} filled={on} size={ICON} color={col} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 14 + ICON + 10, top: 0, bottom: 0, justifyContent: 'center' }, lb]}>
        <Text style={{ fontFamily: font.b, fontSize: 13.5, color: pal.on }} numberOfLines={1}>{label}</Text>
      </Animated.View>
      <RNPressable accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress}
        onPressIn={() => { pr.value = withTiming(1, { duration: 70 }); }} onPressOut={() => { pr.value = withTiming(0, { duration: 140 }); }}
        android_ripple={null} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

function TabBar({ state, navigation }: any) {
  const { t } = useTheme(); const ins = useSafeAreaInsets();
  const [w, setW] = useState(0); const [lw, setLw] = useState<number[]>([]);
  const pal = t.dark ? DARK : LIGHT; const bot = dockBottom(ins.bottom);
  const labels = ITEMS.map((it) => tr(it.k));
  // widths: idle 46x48 (44 on narrow phones); active = pad + icon + gap + label + pad, tightened if the row would not fit
  const inner = w - 2 * PAD; let idleW = 46; let padL = 14; let gap = 10; let padR = 16;
  const lab = lw[state.index] ?? 0;
  if (w && inner - (ITEMS.length - 1) * idleW < padL + ICON + gap + lab + padR) { idleW = 44; padL = 12; gap = 8; padR = 12; }
  const activeW = padL + ICON + gap + lab + padR;
  const ready = w > 0 && lw.length === ITEMS.length && lw.every((x) => x > 0);
  const base = t.dark ? 'rgba(30,26,42,.72)' : 'rgba(255,255,255,.76)';
  // Android: BlurView re-blurs every frame over scrolling lists; a near-opaque solid + border keeps 60fps and still reads as frosted.
  const solid = t.dark ? 'rgba(30,26,42,.95)' : 'rgba(255,255,255,.95)';
  const line = t.dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.75)';
  const sh = t.dark
    ? '0 0 0 0.5px rgba(0,0,0,.4), 0 2px 4px rgba(0,0,0,.3), 0 8px 16px -4px rgba(0,0,0,.4), 0 24px 44px -10px rgba(0,0,0,.6)'
    : '0 0 0 0.5px rgba(29,23,48,.08), 0 2px 4px rgba(29,23,48,.06), 0 8px 16px -4px rgba(29,23,48,.12), 0 24px 44px -10px rgba(29,23,48,.28)';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={t.dark ? ['rgba(20,17,29,0)', 'rgba(20,17,29,.7)'] : ['rgba(251,247,242,0)', 'rgba(251,247,242,.7)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 + Math.max(0, bot - 24) }} />
      <View style={{ marginHorizontal: DOCK_SIDE, marginBottom: bot, height: DOCK_HEIGHT, borderRadius: 30, boxShadow: sh } as any}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 30, overflow: 'hidden', backgroundColor: Platform.OS === 'android' ? solid : 'transparent', borderWidth: 1, borderColor: line }}>
          {Platform.OS !== 'android' && <><BlurView intensity={70} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} /></>}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, opacity: ready ? 1 : 0 }}>
          {ITEMS.map((it, i) => {
            const route = state.routes[i]; const isOn = state.index === i;
            return (
              <DockItem key={it.name} icon={it.icon} label={labels[i]} on={isOn} pal={pal} idleW={idleW} activeW={activeW}
                onPress={() => {
                  const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!isOn && !ev.defaultPrevented) { Haptics.selectionAsync().catch(() => {}); navigation.navigate(route.name); }
                }} />
            );
          })}
        </View>
        {/* hidden measurers: the active pill needs each label's real width, in any language */}
        <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, left: 0, top: 0 }}>
          {labels.map((l, i) => <Text key={i} numberOfLines={1} onLayout={(e) => { const x = Math.ceil(e.nativeEvent.layout.width); setLw((a) => (a[i] === x ? a : Object.assign([...a], { [i]: x }))); }} style={{ fontFamily: font.b, fontSize: 13.5, alignSelf: 'flex-start' }}>{l}</Text>)}
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
