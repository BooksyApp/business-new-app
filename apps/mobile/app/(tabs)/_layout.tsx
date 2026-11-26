import React, { memo, useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Platform, Pressable as RNPressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/Text';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from '@/lib/insets';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';
import { t as tr } from '@/i18n';
import { useApp } from '@/lib/app';
import { DOCK_HEIGHT, DOCK_SIDE, dockBottom } from '@/lib/dock';


const ITEMS = [
  { name: 'calendar', icon: 'cal', k: 'tabs.calendar' }, { name: 'clients', icon: 'users', k: 'tabs.clients' },
  { name: 'notifications', icon: 'bell', k: 'tabs.notifications' }, { name: 'more', icon: 'dots', k: 'tabs.more' },
] as const;
const ICON = 26; const H = 48; const PAD = 9;
const SPRING = { stiffness: 380, damping: 30, mass: 1 };

type Pal = { on: string; off: string; ring: string; pill: string; pillLine: string; press: string };
const LIGHT: Pal = { on: '#4a2fc4', off: '#352e48', ring: '#ffffff', pill: 'rgba(111,82,237,.15)', pillLine: 'rgba(111,82,237,.2)', press: 'rgba(29,23,48,.1)' };
const DARK: Pal = { on: '#ebe5ff', off: '#c4bdd8', ring: '#262034', pill: 'rgba(160,138,255,.26)', pillLine: 'rgba(190,170,255,.3)', press: 'rgba(255,255,255,.1)' };

/** Floating dock (artifact F62): icons only; the active tab opens into a violet pill with its label (width spring 380/30, label fades 140 ms later). */
const DockItem = memo(function DockItem({ icon, label, on, badge, dot, pal, idleW, activeW, onPress, onLongPress }: {
  icon: string; label: string; on: boolean; badge: number; dot: boolean; pal: Pal; idleW: number; activeW: number; onPress: () => void; onLongPress: () => void;
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
    <Animated.View style={[{ height: H, borderRadius: H / 2, overflow: 'visible' }, box]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: H / 2, backgroundColor: pal.pill, borderWidth: 1, borderColor: pal.pillLine }, bg]} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: H / 2, backgroundColor: pal.press }, prs]} />
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: (H - ICON) / 2, width: ICON, height: ICON }, ic]}>
        <Icon name={icon} filled={on} size={ICON} color={col} />
        {badge > 0 && (
          <View style={{ position: 'absolute', top: -6, right: -9, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#d9304a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: pal.ring, boxSizing: 'content-box' } as any}>
            <Text style={{ fontFamily: font.b, fontSize: 10, lineHeight: 12, color: '#fff' }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
        {dot && !on && <LinearGradient colors={['#ff7aa2', '#6f52ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: -3, right: -4, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: pal.ring, boxSizing: 'content-box' } as any} />}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 14 + ICON + 10, top: 0, bottom: 0, justifyContent: 'center' }, lb]}>
        <Text style={{ fontFamily: font.b, fontSize: 13.5, color: pal.on }} numberOfLines={1}>{label}</Text>
      </Animated.View>
      <RNPressable accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress}
        onPressIn={() => { pr.value = withTiming(1, { duration: 70 }); }} onPressOut={() => { pr.value = withTiming(0, { duration: 140 }); }}
        android_ripple={null} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

function TabBar({ state, navigation }: any) {
  const { t } = useTheme(); const ins = useSafeAreaInsets(); const { badges } = useApp();
  const [w, setW] = useState(0); const [lw, setLw] = useState<number[]>([]);
  const dk = t.dark;
  const pal = dk ? DARK : LIGHT; const bot = dockBottom(ins.bottom);
  const labels = ITEMS.map((it) => tr(it.k));
  // widths: idle 46x48 (44 on narrow phones); active = pad 14 + icon + gap 10 + label + pad 16, tightened if the row would not fit
  const inner = w - 2 * PAD; let idleW = 46; let padL = 14; let gap = 10; let padR = 16;
  const lab = lw[state.index] ?? 0;
  if (w && inner - 3 * idleW < padL + ICON + gap + lab + padR) { idleW = 44; padL = 12; gap = 8; padR = 12; }
  const activeW = padL + ICON + gap + lab + padR;
  const ready = w > 0 && lw.length === ITEMS.length && lw.every((x) => x > 0);
  const base = dk ? 'rgba(30,26,42,.72)' : 'rgba(255,255,255,.76)';
  // Android: BlurView (dimezis) re-blurs every frame over photos/scrolling lists; a near-opaque solid + border keeps 60fps and still reads as frosted.
  const solid = dk ? 'rgba(30,26,42,.95)' : 'rgba(255,255,255,.95)';
  const line = dk ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.75)';
  const sh = dk
    ? '0 0 0 0.5px rgba(0,0,0,.4), 0 2px 4px rgba(0,0,0,.3), 0 8px 16px -4px rgba(0,0,0,.4), 0 24px 44px -10px rgba(0,0,0,.6)'
    : '0 0 0 0.5px rgba(29,23,48,.08), 0 2px 4px rgba(29,23,48,.06), 0 8px 16px -4px rgba(29,23,48,.12), 0 24px 44px -10px rgba(29,23,48,.28)';
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={dk ? ['rgba(15,8,30,0)', 'rgba(15,8,30,.55)'] : ['rgba(251,247,242,0)', 'rgba(251,247,242,.55)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 + Math.max(0, bot - 24) }} />
      <View style={{ marginHorizontal: DOCK_SIDE, marginBottom: bot, height: DOCK_HEIGHT, borderRadius: 30, boxShadow: sh } as any}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 30, overflow: 'hidden', backgroundColor: Platform.OS === 'android' ? solid : 'transparent', borderWidth: 1, borderColor: line }}>
          {Platform.OS !== 'android' && <><BlurView intensity={70} tint={dk ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /><View style={[StyleSheet.absoluteFill, { backgroundColor: base }]} /></>}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAD, opacity: ready ? 1 : 0 }}>
          {ITEMS.map((it, i) => {
            const route = state.routes[i]; const isOn = state.index === i;
            return (
              <DockItem key={it.name} icon={it.icon} label={labels[i]} on={isOn} pal={pal} idleW={idleW} activeW={activeW}
                badge={it.name === 'notifications' ? badges.pending + badges.waitlist + badges.inbox : 0} dot={false}
                onPress={() => {
                  const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!isOn && !ev.defaultPrevented) { Haptics.selectionAsync().catch(() => {}); navigation.navigate(route.name); }
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} />
            );
          })}
        </View>
        {/* hidden measurers: the active pill needs each label's real width (13.5/700), in any language */}
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
