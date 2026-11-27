import React, { useEffect, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';

export type DragBounds = { w: number; h: number; top: number; bottom: number; /** right-hand tool column: x beyond `toolX` is off limits above `toolBottom` */ toolX: number; toolBottom: number };

/**
 * Small tag chip that sits ON the photo (Instagram-style). Drag with one finger; the position is clamped inside the photo
 * rect (below the top safe zone, above the bottom controls, clear of the tool column). Tap = change, small x = remove.
 * Positions are visual only: the story/look model has no field for tag coordinates.
 */
export function DragChip({ bounds, slot, label, onPress, onRemove, children }: { bounds: DragBounds; slot: number; label: string; onPress: () => void; onRemove: () => void; children: React.ReactNode }) {
  const x = useSharedValue(8);
  const y = useSharedValue(-1000);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const cw = useSharedValue(0);
  const ch = useSharedValue(0);
  const bw = useSharedValue(bounds.w); const bt = useSharedValue(bounds.top); const bb = useSharedValue(bounds.bottom); const bh = useSharedValue(bounds.h);
  const tx = useSharedValue(bounds.toolX); const tb = useSharedValue(bounds.toolBottom);
  const [ready, setReady] = useState(false);
  const placed = useRef(false);

  useEffect(() => { bw.value = bounds.w; bt.value = bounds.top; bb.value = bounds.bottom; bh.value = bounds.h; tx.value = bounds.toolX; tb.value = bounds.toolBottom; }, [bounds, bw, bt, bb, bh, tx, tb]);

  const onLayout = (w: number, h: number) => {
    cw.value = w; ch.value = h;
    if (!placed.current && bounds.h > 0) { // default: bottom-left, stacked upwards by slot
      placed.current = true;
      x.value = 8;
      y.value = Math.max(bounds.top, bounds.h - bounds.bottom - h - 8 - slot * (h + 8));
      setReady(true);
    }
  };

  const pan = Gesture.Pan().minDistance(4)
    .onStart(() => { 'worklet'; sx.value = x.value; sy.value = y.value; })
    .onUpdate((e) => {
      'worklet';
      const minY = bt.value;
      const maxY = Math.max(minY, bh.value - bb.value - ch.value);
      const ny = Math.min(maxY, Math.max(minY, sy.value + e.translationY));
      const maxX = Math.max(8, (ny < tb.value ? tx.value : bw.value - 8) - cw.value);
      x.value = Math.min(maxX, Math.max(8, sx.value + e.translationX));
      y.value = ny;
    });
  const tap = Gesture.Tap().maxDistance(8).runOnJS(true).onEnd((_e, ok) => { if (ok) onPress(); });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));

  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, top: 0, zIndex: 5, elevation: 5, opacity: ready ? 1 : 0, maxWidth: Math.max(120, bounds.w * 0.7) }, style]}
      onLayout={(e) => onLayout(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Animated.View accessible accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, height: 32, paddingLeft: 12, paddingRight: 6 }}>
          {children}
          <Pressable onPress={onRemove} hitSlop={12} accessibilityRole="button" accessibilityLabel="×" style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(29,23,48,.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={12} color="#1d1730" />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
