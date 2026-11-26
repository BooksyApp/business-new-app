import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { subscribeToast, type ToastMsg } from '@/lib/toast';
import { useSafeAreaInsets } from '@/lib/insets';
import { font } from '@/theme/tokens';

/** Top pill toast: slides in, stays 2.6 s, slides out. Success = ink, error = guava. */
export function ToastHost() {
  const ins = useSafeAreaInsets();
  const [m, setM] = useState<ToastMsg | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => subscribeToast((n) => {
    setM(n);
    if (n) Haptics.notificationAsync(n.kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    y.setValue(0);
    Animated.timing(y, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
  }), [y]);
  useEffect(() => {
    if (!m) return;
    const id = setTimeout(() => Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setM(null)), 2600);
    return () => clearTimeout(id);
  }, [m, y]);
  if (!m) return null;
  const err = m.kind === 'error';
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: ins.top + 6, left: 16, right: 16, zIndex: 200, alignItems: 'center', opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, maxWidth: 520, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 26, backgroundColor: err ? '#e83e63' : '#1d1730', boxShadow: '0 14px 30px -10px rgba(29,23,48,.5)' } as any}>
        <Icon name={err ? 'info' : 'check'} size={20} color="#fff" />
        <Text style={{ flexShrink: 1, fontFamily: font.b, fontSize: 15, lineHeight: 20, color: '#fff' }}>{m.text}</Text>
      </View>
    </Animated.View>
  );
}
