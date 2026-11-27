import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
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
    K.value = k; TX.value = tx; TY.value = ty;
    report(k, tx, ty);
  }, [fw, fh, shape, iw, ih, c, f, zmax]); // eslint-disable-line react-hooks/exhaustive-deps

  const gestures = useMemo(() => {
    const showGrid = () => { 'worklet'; grid.value = withTiming(1, { duration: 120 }); };
    const hideGrid = () => { 'worklet'; grid.value = withDelay(450, withTiming(0, { duration: 300 })); };
    const pinch = Gesture.Pinch()
      .onBegin(() => { 'worklet'; showGrid(); })
      .onStart(() => { 'worklet'; lastScale.value = 1; })
      .onUpdate((e) => {
        'worklet';
        const ds = e.scale / lastScale.value; lastScale.value = e.scale;
        const nk = Math.min(ZMAX.value, Math.max(ZMIN.value, K.value * ds));
        const r = nk / K.value;
        const fx = e.focalX - FW.value / 2; const fy = e.focalY - FH.value / 2;
        K.value = nk;
        TX.value = clampT(fx - (fx - TX.value) * r, IW.value * nk, FW.value);
        TY.value = clampT(fy - (fy - TY.value) * r, IH.value * nk, FH.value);
      })
      .onFinalize(() => { 'worklet'; hideGrid(); runOnJS(report)(K.value, TX.value, TY.value); });
    const pan = Gesture.Pan().minPointers(1).maxPointers(2)
      .onBegin(() => { 'worklet'; showGrid(); })
      .onStart(() => { 'worklet'; lastX.value = 0; lastY.value = 0; })
      .onUpdate((e) => {
        'worklet';
        const dx = e.translationX - lastX.value; const dy = e.translationY - lastY.value;
        lastX.value = e.translationX; lastY.value = e.translationY;
        TX.value = clampT(TX.value + dx, IW.value * K.value, FW.value);
        TY.value = clampT(TY.value + dy, IH.value * K.value, FH.value);
      })
      .onFinalize(() => { 'worklet'; hideGrid(); runOnJS(report)(K.value, TX.value, TY.value); });
    const dbl = Gesture.Tap().numberOfTaps(2).maxDuration(260)
      .onEnd((_e, ok) => {
        'worklet';
        if (!ok || ZFILL.value - ZMIN.value < 0.0001) return;
        const toFit = Math.abs(K.value - ZFILL.value) < ZFILL.value * 0.01;
        const target = toFit ? ZMIN.value : ZFILL.value;
        K.value = withTiming(target, { duration: 220 }); TX.value = withTiming(0, { duration: 220 }); TY.value = withTiming(0, { duration: 220 });
        runOnJS(report)(target, 0, 0);
      });
    return Gesture.Exclusive(dbl, Gesture.Simultaneous(pinch, pan));
  }, [report, K, TX, TY, FW, FH, IW, IH, ZMIN, ZFILL, ZMAX, lastScale, lastX, lastY, grid]);

  const imgStyle = useAnimatedStyle(() => ({ transform: [{ translateX: TX.value }, { translateY: TY.value }, { scale: ZMAX.value > 0 ? K.value / ZMAX.value : 1 }] }));
  const gridStyle = useAnimatedStyle(() => ({ opacity: grid.value }));

  const done = async () => {
    if (busy || fw <= 0) return;
    setBusy(true);
    const k = K.value; const tx = TX.value; const ty = TY.value;
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
      <View style={{ paddingBottom: Math.max(ins.bottom, 14) + 10, paddingTop: 12, gap: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {SHAPES.map((s) => {
            const on = s === shape;
            return (
              <Pressable key={s} onPress={() => { if (!on) onShape(s); }} noScale accessibilityRole="button" accessibilityLabel={chipLabel(s)} accessibilityState={{ selected: on }}
                style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : 'rgba(255,255,255,.14)' }}>
                <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13.5, color: on ? '#1d1730' : '#fff' }}>{chipLabel(s)}</Text>
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
