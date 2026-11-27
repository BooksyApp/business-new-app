import React, { useCallback, useEffect, useState } from 'react';
import { t as tr } from '@/i18n';
import { Modal, Pressable as RNPressable, StyleProp, StyleSheet, ViewStyle, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { interpolate, runOnJS, useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ToastHost } from '@/components/ToastHost';
import { useTheme } from '@/theme/ThemeContext';

/**
 * iOS silently drops a <Modal> that is presented while another Modal is still dismissing, so a sheet that opens in the same tick as the
 * sheet that launched it ("+" -> Vaxtı blokla, menu -> Vaxtı blokla) never appeared on a real phone. Sheets that are closing are
 * counted here; an opening sheet waits until none is left (plus a short settle) before it mounts.
 */
const closing = new Set<number>();
const waiters = new Set<() => void>();
let nextId = 1;
const notify = () => { if (!closing.size) { const w = [...waiters]; waiters.clear(); w.forEach((f) => f()); } };

const SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

/** v2 Sheet (artifact .sheet): 30 radius, 38x5 grabber, near-white surface, scrim .38. */
/**
 * One draggable bottom sheet for the whole app. Height follows the content unless `snaps` (visible heights in px, or 0-1 fractions of the
 * window) are given: then the sheet springs between them and dismisses when dragged below the lowest. Backdrop fades with the drag.
 */
export function BottomSheet({ open, onClose, children, snaps, radius = 30, contentStyle, handle = true }: {
  open: boolean; onClose: () => void; children: React.ReactNode; snaps?: number[]; radius?: number; contentStyle?: StyleProp<ViewStyle>; handle?: boolean;
}) {
  const { t } = useTheme(); const { height: H } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const id = React.useRef(nextId++).current;
  const [ch, setCh] = useState(0);
  const pts = snaps?.map((s) => (s <= 1 ? s * H : s)).sort((a, b) => a - b);
  const sh = useSharedValue(H); const y = useSharedValue(H); const start = useSharedValue(0);
  const kb = useAnimatedKeyboard();
  const sheetH = pts ? pts[pts.length - 1] : ch;
  const sorted = useSharedValue<number[]>(pts ?? []);
  useEffect(() => { sh.value = sheetH || H; sorted.value = pts ?? []; });

  const unmount = useCallback(() => { setMounted(false); setTimeout(() => { closing.delete(id); notify(); }, 160); }, [id]);
  useEffect(() => {
    if (!open) return;
    if (!closing.size || closing.has(id)) { closing.delete(id); setMounted(true); return; }
    let live = true;
    const go = () => { if (live) setMounted(true); };
    waiters.add(go);
    const guard = setTimeout(() => { waiters.delete(go); go(); }, 900); // never wait forever
    return () => { live = false; waiters.delete(go); clearTimeout(guard); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open && mounted) closing.add(id); }, [open, mounted, id]);
  useEffect(() => () => { closing.delete(id); notify(); }, [id]);
  useEffect(() => {
    if (!mounted || !sheetH) return;
    if (open) { Haptics.selectionAsync().catch(() => {}); y.value = withSpring(pts ? sheetH - pts[0] : 0, SPRING); }
    else y.value = withTiming(sheetH + 40, { duration: 220 }, (done) => { if (done) runOnJS(unmount)(); });
  }, [open, mounted, sheetH]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open && mounted && !sheetH) unmount(); }, [open, mounted, sheetH]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = Gesture.Pan().activeOffsetY([-12, 12]).failOffsetX([-24, 24])
    .onStart(() => { start.value = y.value; })
    .onUpdate((e) => {
      const lo = sh.value - (sorted.value.length ? sorted.value[sorted.value.length - 1] : sh.value);
      const next = start.value + e.translationY;
      y.value = next < lo ? lo + (next - lo) * 0.25 : next; // rubber band above the top snap
    })
    .onEnd((e) => {
      const vis = sh.value - y.value; const list = sorted.value.length ? sorted.value : [sh.value];
      const lowest = list[0];
      if (e.velocityY > 900 && vis <= lowest + 8 || vis < lowest * 0.55) { runOnJS(onClose)(); return; }
      let best = list[0];
      const proj = vis - e.velocityY * 0.12;
      for (const p of list) if (Math.abs(p - proj) < Math.abs(best - proj)) best = p;
      y.value = withSpring(sh.value - best, { ...SPRING, velocity: e.velocityY });
    });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.value - kb.height.value }] }));
  const dim = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, sh.value + 40], [1, 0], 'clamp') }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,14,34,.38)' }, dim]}>
          <RNPressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View onLayout={(e) => setCh(e.nativeEvent.layout.height)}
            style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: t.dark ? t.surface : 'rgba(255,255,255,.97)', borderTopLeftRadius: radius, borderTopRightRadius: radius, paddingTop: 10, paddingHorizontal: 20, paddingBottom: 24, boxShadow: '0 -20px 50px -20px rgba(29,23,48,.35)' } as any, pts ? { height: sheetH + 0 } : null, contentStyle, sheet]}>
            {handle && <Animated.View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: t.dark ? 'rgba(255,255,255,.2)' : 'rgba(29,23,48,.18)', alignSelf: 'center', marginBottom: 14 }} />}
            {children}
          </Animated.View>
        </GestureDetector>
        <ToastHost modal />
      </GestureHandlerRootView>
    </Modal>
  );
}
