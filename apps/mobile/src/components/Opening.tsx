import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Wordmark } from '@/components/Wordmark';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { font, mesh, photoShadow } from '@/theme/tokens';

const KEY = 'booqi.biz.opening.v1';
const CANVAS = '#fbf7f2'; const INK = '#1d1730'; const MUTED = '#6b6158';
/** F01 Açılış: tile geometry is taken from the frame (393 pt wide design); left/top/w/h/rotation/float delay. */
const TILES = [
  { img: require('../../assets/img/p7755209.jpg'), l: 22, t: 92, w: 132, h: 170, r: -7, d: 0, pos: '50% 20%' },
  { img: require('../../assets/img/p3997381.jpg'), l: 176, t: 70, w: 108, h: 132, r: 5, d: 1 },
  { img: require('../../assets/img/p7781852.jpg'), l: 290, t: 150, w: 92, h: 118, r: -4, d: 2 },
  { img: require('../../assets/img/p7755650.jpg'), l: 52, t: 290, w: 104, h: 128, r: 6, d: 1.5 },
  { img: require('../../assets/img/p7510147.jpg'), l: 176, t: 226, w: 150, h: 186, r: -3, d: 0.5 },
  { img: require('../../assets/img/f01.jpg'), l: 318, t: 300, w: 84, h: 100, r: 8, d: 2.5 },
];

function Tile({ g, k, i }: { g: (typeof TILES)[number]; k: number; i: number }) {
  const enter = useRef(new Animated.Value(0)).current; const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 520, delay: 120 + i * 130, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const id = setTimeout(() => loop.start(), g.d * 300);
    return () => { clearTimeout(id); loop.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[{ position: 'absolute', left: g.l * k, top: g.t * k, width: g.w * k, height: g.h * k, borderRadius: 24, overflow: 'hidden', borderWidth: 4, borderColor: '#fff', backgroundColor: '#fff' }, photoShadow,
      { opacity: enter, transform: [{ rotate: `${g.r}deg` }, { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
      <Image source={g.img} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </Animated.View>
  );
}

/** F01 Açılış: the collage of real work gathers, then straight into Kəşf (no slides, no form). Shown once per install. */
export function Opening() {
  const { width } = useWindowDimensions(); const k = width / 393;
  const [show, setShow] = useState(false); const fade = useRef(new Animated.Value(1)).current;
  const done = useRef(false); const pill = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(pill, { toValue: 1, duration: 600, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = () => {
    if (done.current) return; done.current = true;
    AsyncStorage.setItem(KEY, '1').catch(() => {});
    Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => setShow(false));
  };
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem(KEY).then((v) => { if (v !== '1') { setShow(true); id = setTimeout(finish, 2600); } }).catch(() => {});
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, opacity: fade, backgroundColor: CANVAS }}>
      <Pressable style={{ flex: 1 }} onPress={finish} accessibilityLabel="booqi business">
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          experimental_backgroundImage: `radial-gradient(70% 45% at 50% 100%, rgba(255,217,161,.55), rgba(255,217,161,0) 70%), ${mesh}` } as any} />
        {TILES.map((g, i) => <Tile key={i} g={g} k={k} i={i} />)}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center' }}>
          <View style={{ marginBottom: 14 }}><Wordmark height={81} /></View>
          <Animated.View style={{ opacity: pill, transform: [{ translateY: pill.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }], height: 34, paddingHorizontal: 18, borderRadius: 17, backgroundColor: '#6f52ed', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontFamily: font.x, fontSize: 13.5, letterSpacing: 1.8, color: '#fff' }}>{tr('ux.businessPill')}</Text>
          </Animated.View>
          <Text style={{ fontFamily: font.x, fontSize: 24, letterSpacing: -0.48, lineHeight: 28.8, color: INK, textAlign: 'center' }}>{tr('ux.openingTitle')}</Text>
          <Text style={{ fontFamily: font.s, fontSize: 14, color: MUTED, marginTop: 10, textAlign: 'center' }}>{tr('ux.openingSub')}</Text>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 92, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#6f52ed' }} />
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: '#ffa8bb', opacity: 0.6 }} />
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: INK, opacity: 0.25 }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
