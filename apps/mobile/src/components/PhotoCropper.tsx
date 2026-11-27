import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { useSafeAreaInsets } from '@/lib/insets';
import type { Picked } from '@/lib/pick';
import { toast } from '@/lib/toast';
import { font } from '@/theme/tokens';

export type CropShape = 'orig' | '1:1' | '4:5' | '9:16';
/** Framing that survives leaving the screen: z = zoom / fill-zoom, nx / ny = image-centre offset as a fraction of the frame. */
export type CropView = { shape: CropShape; z: number; nx: number; ny: number };
export type Sized = Picked & { width: number; height: number };
export type Cropped = Sized;

const MAX_SIDE = 2048;
/** Zoom snaps to fit / fill when within 4.5 % of them. */
const SNAP = 0.045;
const SETTLE = { damping: 22, stiffness: 240, mass: 0.8 };
const tickJs = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

/** Rubber band: inside [-m, m] it follows the finger 1:1; beyond, it gives way at 35 % and never more than 10 % of the frame. */
function rub(t: number, m: number, frame: number) {
  'worklet';
  const a = Math.abs(t);
  if (a <= m) return t;
  return (t < 0 ? -1 : 1) * (m + Math.min(frame * 0.1, (a - m) * 0.35));
}
const SHAPES: CropShape[] = ['orig', '1:1', '4:5', '9:16'];
const RATIO: Record<Exclude<CropShape, 'orig'>, number> = { '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 };

/** Keeps an axis inside the frame: when the photo is larger than the frame it may not leave a gap, when smaller it stays centred. */
function clampT(t: number, disp: number, frame: number) {
  'worklet';
  const m = Math.max(0, (disp - frame) / 2);
  return Math.min(m, Math.max(-m, t));
}

/**
 * Crop rectangle in ORIGINAL pixels. Frame centre = origin, k = screen px per image px, (tx, ty) = image centre in frame coords:
 *   u = iw/2 + (x - tx) / k   for x in [-fw/2, fw/2] intersected with the photo [tx - iw*k/2, tx + iw*k/2]
 * so zoomed-out letterbox bars are never part of the result. Output: that rect, long side capped at 2048, never upscaled, JPEG .92.
 */
export async function cropPhoto(p: Sized, fw: number, fh: number, k: number, tx: number, ty: number): Promise<Cropped> {
  const iw = p.width; const ih = p.height;
  const span = (frame: number, t: number, size: number) => {
    const a = Math.max(-frame / 2, t - (size * k) / 2); const b = Math.min(frame / 2, t + (size * k) / 2);
    const o = Math.min(size - 1, Math.max(0, Math.round(size / 2 + (a - t) / k)));
    const e = Math.min(size, Math.max(o + 1, Math.round(size / 2 + (b - t) / k)));
    return { o, n: e - o };
  };
  const X = span(fw, tx, iw); const Y = span(fh, ty, ih);
  const actions: ImageManipulator.Action[] = [];
  if (X.o !== 0 || Y.o !== 0 || X.n !== iw || Y.n !== ih) actions.push({ crop: { originX: X.o, originY: Y.o, width: X.n, height: Y.n } });
  let w = X.n; let h = Y.n;
  const long = Math.max(w, h);
  if (long > MAX_SIDE) { const s = MAX_SIDE / long; w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s)); actions.push({ resize: { width: w, height: h } }); }
  if (!actions.length) return p;
  const r = await ImageManipulator.manipulateAsync(p.uri, actions, { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: r.uri, name: 'photo.jpg', type: 'image/jpeg', width: r.width || w, height: r.height || h };
}

/**
 * Instagram-like framing step. Pinch (focal-point zoom, from "fit" = whole photo with bars up to 3x "fill"), one-finger pan, double tap
 * toggles fit/fill, rule-of-thirds grid while touching. All gesture maths runs as worklets on shared values; the JS side only hears the final view.
 */
export function PhotoCropper({ photo, shape, onShape, initial, onView, onBack, onDone, softFail }: { photo: Sized; shape: CropShape; onShape: (s: CropShape) => void; initial?: CropView; onView: (v: CropView) => void; onBack: () => void; onDone: (c: Cropped, v: CropView) => void; /** demo / remote assets: if the manipulator cannot process the photo, continue with it uncropped instead of failing */ softFail?: boolean }) {
  const ins = useSafeAreaInsets();
  const iw = photo.width; const ih = photo.height;
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const ratio = shape === 'orig' ? iw / ih : RATIO[shape];
  const fw = Math.max(0, Math.floor(Math.min(avail.w, avail.h * ratio)));
  const fh = ratio > 0 ? Math.floor(fw / ratio) : 0;
  const c = fw > 0 ? Math.max(fw / iw, fh / ih) : 1; // fill scale
  const f = fw > 0 ? Math.min(fw / iw, fh / ih) : 1; // fit scale
  const zmax = c * 3;

  const K = useSharedValue(1); const TX = useSharedValue(0); const TY = useSharedValue(0);
  const FW = useSharedValue(0); const FH = useSharedValue(0); const IW = useSharedValue(iw); const IH = useSharedValue(ih);
  const ZMIN = useSharedValue(1); const ZFILL = useSharedValue(1); const ZMAX = useSharedValue(1);
  const lastScale = useSharedValue(1); const lastX = useSharedValue(0); const lastY = useSharedValue(0);
  const grid = useSharedValue(0);
  const RK = useSharedValue(1); const RX = useSharedValue(0); const RY = useSharedValue(0); // raw (finger-driven, un-snapped) zoom and offset
  const EX = useSharedValue(0); const EY = useSharedValue(0); const MODE = useSharedValue(0); const LAST = useSharedValue(0); const TOUCH = useSharedValue(0);
  const [mode, setMode] = useState<0 | 1 | 2>(2); // 1 = fit (original), 2 = fill, 0 = free zoom

  const applyMode = useCallback((m: number) => setMode(m === 1 ? 1 : m === 2 ? 2 : 0), []);
  const geo = useRef({ c, fw, fh, shape, onView });
  geo.current = { c, fw, fh, shape, onView };
  const report = useCallback((k: number, tx: number, ty: number) => {
    const g = geo.current;
    if (g.fw > 0) g.onView({ shape: g.shape, z: k / g.c, nx: tx / g.fw, ny: ty / g.fh });
  }, []);

  const restored = useRef(false);
  useEffect(() => {
    if (fw <= 0) return;
    FW.value = fw; FH.value = fh; IW.value = iw; IH.value = ih; ZMIN.value = f; ZFILL.value = c; ZMAX.value = zmax;
    const back = !restored.current && initial && initial.shape === shape ? initial : null;
    restored.current = true;
    const k = back ? Math.min(zmax, Math.max(f, back.z * c)) : c;
    const tx = back ? clampT(back.nx * fw, iw * k, fw) : 0;
    const ty = back ? clampT(back.ny * fh, ih * k, fh) : 0;
    K.value = k; TX.value = tx; TY.value = ty; RK.value = k; RX.value = tx; RY.value = ty;
    const m = Math.abs(k - f) < f * 0.001 ? 1 : Math.abs(k - c) < c * 0.001 ? 2 : 0;
    MODE.value = m; applyMode(m);
    report(k, tx, ty);
  }, [fw, fh, shape, iw, ih, c, f, zmax]); // eslint-disable-line react-hooks/exhaustive-deps

  const gestures = useMemo(() => {
    /** One light tick, never more often than every 110 ms (so a finger hovering at a snap point can not buzz). */
    const tick = () => {
      'worklet';
      const now = Date.now();
      if (now - LAST.value < 110) return;
      LAST.value = now; runOnJS(tickJs)();
    };
    /** Raw (finger-driven) zoom -> displayed zoom: magnetic at fit / fill, rubber-band beyond [fit, max]. Sets MODE and ticks once per snap entry. */
    const shown = (rk: number) => {
      'worklet';
      const zmin = ZMIN.value; const zf = ZFILL.value; const zmx = ZMAX.value;
      let k = rk; let m = 0;
      if (Math.abs(rk / zmin - 1) < SNAP) { k = zmin; m = 1; }
      else if (zf - zmin > zmin * 0.01 && Math.abs(rk / zf - 1) < SNAP) { k = zf; m = 2; }
      else if (rk < zmin) k = zmin * (1 - (1 - rk / zmin) * 0.5);
      else if (rk > zmx) k = zmx * (1 + (rk / zmx - 1) * 0.5);
      if (m !== 0 && m !== MODE.value) tick();
      if (m !== MODE.value) { MODE.value = m; runOnJS(applyMode)(m); }
      return k;
    };
    /** Leaves the rubber band: springs zoom and offset back inside the legal range once the last finger is up, then tells the screen. */
    const settle = () => {
      'worklet';
      const fk = Math.min(ZMAX.value, Math.max(ZMIN.value, K.value));
      const ftx = clampT(TX.value, IW.value * fk, FW.value); const fty = clampT(TY.value, IH.value * fk, FH.value);
      RK.value = fk; RX.value = ftx; RY.value = fty; EX.value = 0; EY.value = 0;
      if (fk !== K.value) K.value = withSpring(fk, SETTLE);
      if (ftx !== TX.value) TX.value = withSpring(ftx, SETTLE);
      if (fty !== TY.value) TY.value = withSpring(fty, SETTLE);
      runOnJS(report)(fk, ftx, fty);
    };
    const touch = () => { 'worklet'; TOUCH.value += 1; grid.value = withTiming(1, { duration: 120 }); };
    const release = () => {
      'worklet';
      TOUCH.value = Math.max(0, TOUCH.value - 1);
      if (TOUCH.value === 0) { grid.value = withDelay(450, withTiming(0, { duration: 300 })); settle(); }
    };
    const pinch = Gesture.Pinch()
      .onBegin(() => { 'worklet'; touch(); })
      .onStart(() => { 'worklet'; lastScale.value = 1; RK.value = K.value; })
      .onUpdate((e) => {
        'worklet';
        const ds = e.scale / lastScale.value; lastScale.value = e.scale;
        RK.value = Math.min(ZMAX.value * 1.2, Math.max(ZMIN.value * 0.8, RK.value * ds));
        const nk = shown(RK.value);
        const r = nk / K.value;
        const fx = e.focalX - FW.value / 2; const fy = e.focalY - FH.value / 2;
        K.value = nk;
        // focal point stays under the fingers; the offset may overshoot a little (rubber) and is pulled back by settle()
        TX.value = rub(fx - (fx - TX.value) * r, Math.max(0, (IW.value * nk - FW.value) / 2), FW.value);
        TY.value = rub(fy - (fy - TY.value) * r, Math.max(0, (IH.value * nk - FH.value) / 2), FH.value);
        RX.value = TX.value; RY.value = TY.value;
      })
      .onFinalize(() => { 'worklet'; release(); });
    const pan = Gesture.Pan().minPointers(1).maxPointers(2)
      .onBegin(() => { 'worklet'; touch(); })
      .onStart(() => { 'worklet'; lastX.value = 0; lastY.value = 0; RX.value = TX.value; RY.value = TY.value; })
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX - lastX.value; const dy = e.translationY - lastY.value;
        lastX.value = e.translationX; lastY.value = e.translationY;
        const mx = Math.max(0, (IW.value * K.value - FW.value) / 2); const my = Math.max(0, (IH.value * K.value - FH.value) / 2);
        RX.value += dx; RY.value += dy;
        TX.value = rub(RX.value, mx, FW.value); TY.value = rub(RY.value, my, FH.value);
        // edge contact: photo edge flush with the frame edge, one tick per contact
        const ex = mx > 1 && RX.value >= mx ? 1 : mx > 1 && RX.value <= -mx ? -1 : 0;
        const ey = my > 1 && RY.value >= my ? 1 : my > 1 && RY.value <= -my ? -1 : 0;
        if (ex !== EX.value) { EX.value = ex; if (ex !== 0) tick(); }
        if (ey !== EY.value) { EY.value = ey; if (ey !== 0) tick(); }
      })
      .onFinalize(() => { 'worklet'; release(); });
    const dbl = Gesture.Tap().numberOfTaps(2).maxDuration(260)
      .onEnd((_e, ok) => {
        'worklet';
        if (!ok || ZFILL.value - ZMIN.value < 0.0001) return;
        const toFit = Math.abs(K.value - ZFILL.value) < ZFILL.value * 0.01;
        const target = toFit ? ZMIN.value : ZFILL.value;
        K.value = withTiming(target, { duration: 220 }); TX.value = withTiming(0, { duration: 220 }); TY.value = withTiming(0, { duration: 220 });
        RK.value = target; RX.value = 0; RY.value = 0; EX.value = 0; EY.value = 0;
        MODE.value = toFit ? 1 : 2; runOnJS(applyMode)(MODE.value); tick();
        runOnJS(report)(target, 0, 0);
      });
    return Gesture.Exclusive(dbl, Gesture.Simultaneous(pinch, pan));
  }, [report, applyMode, K, TX, TY, FW, FH, IW, IH, ZMIN, ZFILL, ZMAX, lastScale, lastX, lastY, grid, RK, RX, RY, EX, EY, MODE, LAST, TOUCH]);

  const imgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: TX.value }, { translateY: TY.value }, { scale: ZMAX.value > 0 ? K.value / ZMAX.value : 1 }] }));
  const gridStyle = useAnimatedStyle(() => ({ opacity: grid.value }));

  const done = async () => {
    if (busy || fw <= 0) return;
    setBusy(true);
    const k = Math.min(zmax, Math.max(f, K.value)); const tx = clampT(TX.value, iw * k, fw); const ty = clampT(TY.value, ih * k, fh);
    try {
      const out = await cropPhoto(photo, fw, fh, k, tx, ty);
      onDone(out, { shape, z: k / c, nx: tx / fw, ny: ty / fh });
    } catch { if (softFail) onDone(photo, { shape, z: k / c, nx: tx / fw, ny: ty / fh }); else toast(tr('v3.cropFail'), 'error'); } finally { setBusy(false); }
  };

  const line = { position: 'absolute' as const, backgroundColor: 'rgba(255,255,255,.75)' };
  const chipLabel = (s: CropShape) => (s === 'orig' ? tr('v3.cropOrig') : s === '9:16' ? '9:16 · Story' : s);
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ height: ins.top + 54, paddingTop: ins.top + 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('common.back')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color="#fff" /></Pressable>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: font.s, fontSize: 13, color: 'rgba(255,255,255,.7)', paddingRight: 44 }}>{tr('v3.cropHint')}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setAvail({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {fw > 0 ? (
          <GestureDetector gesture={gestures}>
            <View style={{ width: fw, height: fh, overflow: 'hidden', backgroundColor: '#000' }}>
              <Image source={{ uri: photo.uri }} blurRadius={24} resizeMode="cover" accessibilityIgnoresInvertColors style={{ position: 'absolute', left: 0, top: 0, width: fw, height: fh }} />
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: fw, height: fh, backgroundColor: 'rgba(0,0,0,.55)' }} />
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (fw - iw * zmax) / 2, top: (fh - ih * zmax) / 2, width: iw * zmax, height: ih * zmax }, imgStyle]}>
                <Image source={{ uri: photo.uri }} resizeMode="stretch" accessibilityIgnoresInvertColors style={{ width: iw * zmax, height: ih * zmax }} />
              </Animated.View>
              <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: fw, height: fh }, gridStyle]}>
                <View style={{ ...line, left: fw / 3, top: 0, width: 1, height: fh }} />
                <View style={{ ...line, left: (2 * fw) / 3, top: 0, width: 1, height: fh }} />
                <View style={{ ...line, top: fh / 3, left: 0, height: 1, width: fw }} />
                <View style={{ ...line, top: (2 * fh) / 3, left: 0, height: 1, width: fw }} />
              </Animated.View>
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: fw, height: fh, borderWidth: 1, borderColor: 'rgba(255,255,255,.35)' }} />
            </View>
          </GestureDetector>
        ) : null}
      </View>
      <View style={{ paddingBottom: Math.max(ins.bottom, 14) + 10, paddingTop: 8, gap: 12, paddingHorizontal: 16 }}>
        <Text numberOfLines={1} style={{ textAlign: 'center', height: 18, fontFamily: font.s, fontSize: 12.5, color: 'rgba(255,255,255,.8)' }}>{mode === 1 ? tr('v3.cropOrig') : mode === 2 ? tr('v3.cropFill') : ''}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {SHAPES.map((s) => {
            const on = s === shape;
            return (
              <Pressable key={s} onPress={() => { if (!on) onShape(s); }} noScale accessibilityRole="button" accessibilityLabel={chipLabel(s)} accessibilityState={{ selected: on }}
                style={{ height: 30, paddingHorizontal: 11, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,.14)' }}>
                <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12, color: on ? '#1d1730' : '#fff' }}>{chipLabel(s)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => void done()} disabled={busy} accessibilityRole="button" accessibilityLabel={tr('v3.cropNext')} style={{ height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', opacity: busy ? 0.85 : 1 }}>
          {busy ? <ActivityIndicator color="#1d1730" /> : null}
          <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: '#1d1730' }}>{busy ? tr('v3.cropBusy') : tr('v3.cropNext')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
