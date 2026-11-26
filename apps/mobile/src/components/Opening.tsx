import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Wordmark } from '@/components/Wordmark';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { font, gradBiz } from '@/theme/tokens';

const KEY = 'booqi.biz.opening.v2';
const INK = '#1d1730'; const CREAM = '#fbf7f2';

/** "BİZNES ÜÇÜN" gradient pill (artifact `.bpill`). */
export function BizPill({ style }: { style?: object }) {
  return (
    <LinearGradient colors={[...gradBiz]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      style={[{ height: 32, paddingHorizontal: 16, borderRadius: 16, justifyContent: 'center', boxShadow: '0 8px 20px -10px rgba(232,62,99,.7)' } as object, style]}>
      <Text style={{ fontFamily: font.x, fontSize: 12, letterSpacing: 2.16, color: CREAM }}>{tr('v2.bizPill')}</Text>
    </LinearGradient>
  );
}

/**
 * Açılış (artifact "Açılış"): the screen that follows the icon. Ink, one soft violet glow, cream wordmark with the
 * gradient "o", the BİZNES ÜÇÜN pill and one quiet line. No photos. Once per install, ~1.8 s, tap to skip.
 */
export function Opening() {
  const [show, setShow] = useState(false);
  const fade = useRef(new Animated.Value(1)).current; const rise = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const finish = () => {
    if (done.current) return; done.current = true;
    AsyncStorage.setItem(KEY, '1').catch(() => {});
    Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => setShow(false));
  };
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === '1') return;
      setShow(true);
      Animated.timing(rise, { toValue: 1, duration: 520, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      id = setTimeout(finish, 1800);
    }).catch(() => {});
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, opacity: fade, backgroundColor: INK }}>
      <Pressable style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onPress={finish} accessibilityLabel="booqi Biznes">
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'radial-gradient(60% 40% at 50% 38%, rgba(111,82,237,.28), rgba(111,82,237,0) 70%)' } as object} />
        <Animated.View style={{ alignItems: 'center', gap: 18, opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <Wordmark height={86} color={CREAM} g1="#D8CCFF" g2="#FFC2CF" />
          <BizPill />
        </Animated.View>
        <Text style={{ position: 'absolute', bottom: 58, fontFamily: font.r, fontSize: 12.5, color: 'rgba(251,247,242,.6)' }}>{tr('v2.tagline').replace(/\.$/, '')}</Text>
      </Pressable>
    </Animated.View>
  );
}
