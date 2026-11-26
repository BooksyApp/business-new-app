import React from 'react';
import { Pressable as RNPressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

/** Drop-in Pressable: scale .97 + opacity on press (UI-thread worklets), 44pt minimum hit area via hitSlop. */
export const Pressable = React.forwardRef<any, Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>); noScale?: boolean; haptic?: boolean }>(function Pressable(
  { style, onPressIn, onPressOut, onPress, noScale, haptic, hitSlop, ...rest }, ref,
) {
  const k = useSharedValue(0);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - 0.12 * k.value,
    transform: noScale ? [] : [{ scale: 1 - 0.03 * k.value }],
  }));
  const base: StyleProp<ViewStyle> = typeof style === 'function' ? style({ pressed: false }) : style;
  return (
    <AnimatedPressable
      ref={ref}
      hitSlop={hitSlop ?? 6}
      {...rest}
      onPress={onPress ? (e) => { if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(e); } : undefined}
      onPressIn={(e) => { k.value = withTiming(1, { duration: 70 }); onPressIn?.(e); }}
      onPressOut={(e) => { k.value = withSpring(0, { damping: 16, stiffness: 320 }); onPressOut?.(e); }}
      style={[base, a]}
    />
  );
});
