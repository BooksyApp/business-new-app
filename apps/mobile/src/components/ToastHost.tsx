import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { modalCount, subscribeToast, type ToastMsg } from '@/lib/toast';
import { useSafeAreaInsets } from '@/lib/insets';
import { font } from '@/theme/tokens';
import { dockTop } from '@/lib/dock';

/** v2 toast (artifact .toast): ink pill above the dock, green check; error = guava. Stays 2.6 s. */
export function ToastHost({ modal }: { modal?: boolean } = {}) {
  const ins = useSafeAreaInsets();
  const [m, setM] = useState<ToastMsg | null>(null);
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (modal) { modalCount.n++; return () => { modalCount.n--; }; } return undefined; }, [modal]);
  useEffect(() => subscribeToast((n) => {
    if (!modal && modalCount.n > 0) return; // an open modal shows it
    if (modal && modalCount.n < 1) return;
    setM(n);
    if (n) Haptics.notificationAsync(n.kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
    y.setValue(0);
    Animated.timing(y, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
  }), [y, modal]);
  useEffect(() => {
    if (!m) return;
    const id = setTimeout(() => Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setM(null)), 2600);
    return () => clearTimeout(id);
  }, [m, y]);
  if (!m) return null;
  const err = m.kind === 'error';
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', bottom: dockTop(ins.bottom) + 16, left: 16, right: 16, zIndex: 200, alignItems: 'center', opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 42, maxWidth: 520, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 16, backgroundColor: err ? '#e83e63' : '#1d1730', boxShadow: '0 14px 30px -10px rgba(29,23,48,.5)' } as any}>
        <Icon name={err ? 'info' : 'check'} filled={!err} size={17} color={err ? '#fff' : '#7fd8a4'} />
        <Text style={{ flexShrink: 1, fontFamily: font.s, fontSize: 13.5, lineHeight: 18, color: '#fff' }}>{m.text}</Text>
      </View>
    </Animated.View>
  );
}
