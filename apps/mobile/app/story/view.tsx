import React, { useEffect, useRef, useState } from 'react';
import { Alert, PanResponder, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, Photo, T } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { TagLayer, parseTags } from '@/components/TagLayer';
import { t as tr } from '@/i18n';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { useSafeAreaInsets } from '@/lib/insets';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { font } from '@/theme/tokens';

const DURATION = 5000;

/**
 * Full-screen story viewer: segmented progress bars (auto-advance 5 s), tap left/right for previous/next, swipe down to close.
 * mode "own": the salon's own story with the viewer count, share and delete. mode "team": a specialist's story with a reply field and a heart.
 * There is no reply endpoint yet: in demo mode the reply is a no-op toast, in live mode a calm "not available yet" toast.
 */
export default function StoryView() {
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const { salon, demo, bump } = useApp();
  const { i, mode = 'own', name, avatar } = useLocalSearchParams<{ i?: string; mode?: string; name?: string; avatar?: string }>();
  const sid = salon?.id ?? '';
  const st = useLoad(() => apiX.stories(sid).catch(() => []), [sid]);
  const list = st.data ?? [];
  const [idx, setIdx] = useState(Number(i ?? 0) || 0);
  const [p, setP] = useState(0);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/looks'));
  const cur = list[Math.min(idx, Math.max(0, list.length - 1))];
  const next = () => { if (idx < list.length - 1) { setIdx(idx + 1); setP(0); } else close(); };
  const prev = () => { if (idx > 0) { setIdx(idx - 1); setP(0); } else setP(0); };
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!list.length || paused) return;
    tick.current = setInterval(() => setP((v) => Math.min(1, v + 50 / DURATION)), 50);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [list.length, paused, idx]);
  useEffect(() => { if (p >= 1) next(); }, [p]); // eslint-disable-line react-hooks/exhaustive-deps
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 14 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderRelease: (_e, g) => { if (g.dy > 80) close(); },
  })).current;
  const own = mode !== 'team';
  const who = own ? salon?.name ?? '' : name ?? '';
  const sendReply = (kind: 'reply' | 'heart') => {
    if (demo) { toast(tr('v2.demoNoSave'), 'info'); if (kind === 'reply') setReply(''); else setLiked(true); return; }
    toast(tr('v3.replyLater'), 'info');
  };
  const del = () => cur && Alert.alert(tr('lk.confirmDelete'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiX.deleteStory(sid, String(cur.id)).then(() => { bump(); close(); }).catch((e: Error) => toast(e.message, 'error')); } }]);
  const sticker = cur?.caption?.includes('·');
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} {...pan.panHandlers}>
      {cur ? <Photo src={cur.url} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} /> : null}
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,.45)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 150 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,.5)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 180 }} />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
        <Pressable onPress={prev} accessibilityRole="button" accessibilityLabel={tr('v2.back')} noScale style={{ flex: 1 }} />
        <Pressable onPress={next} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityRole="button" accessibilityLabel={tr('v2.next')} noScale style={{ flex: 2 }} />
      </View>
      <View style={{ position: 'absolute', left: 12, right: 12, top: ins.top + 8, flexDirection: 'row', gap: 4 }} pointerEvents="none">
        {(list.length ? list : [0]).map((_, k) => (
          <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.35)', overflow: 'hidden' }}>
            <View style={{ width: `${(k < idx ? 1 : k === idx ? p : 0) * 100}%`, height: 3, backgroundColor: '#fff' }} />
          </View>
        ))}
      </View>
      <View style={{ position: 'absolute', left: 14, right: 8, top: ins.top + 22, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar uri={own ? (salon as { logoUrl?: string } | null)?.logoUrl : avatar} name={who} size={34} />
        <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14, color: '#fff', flexShrink: 1 }}>{who} <Text style={{ fontFamily: font.r, color: 'rgba(255,255,255,.8)' }}>{tr('v3.hourAgo')}</Text></Text>
        <View style={{ flex: 1 }} />
        {own ? <Pressable onPress={del} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="dots" size={22} color="#fff" /></Pressable> : null}
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={tr('v2.close')} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={22} color="#fff" /></Pressable>
      </View>
      <TagLayer tags={parseTags(cur?.tags)} w={SW} h={SH} top={ins.top + 84} bottom={Math.max(ins.bottom, 12) + 70} />
      {cur?.caption ? (
        <View style={{ position: 'absolute', left: 20, bottom: own ? 110 : 120, maxWidth: '78%', backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: sticker ? 10 : 8, transform: [{ rotate: '-3deg' }] }}>
          {sticker ? <T k="xs" color="#8c8177">{tr('v2.service')}</T> : null}
          <Text style={{ fontFamily: font.b, fontSize: 15, color: '#1d1730' }}>{cur.caption}</Text>
          {sticker ? <Text style={{ fontFamily: font.b, fontSize: 13, color: '#5b3fd6', marginTop: 2 }}>{tr('v3.bookCta')} ›</Text> : null}
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom, 12) + 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {own ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Icon name="eye" size={20} color="#fff" />
              <Text style={{ fontFamily: font.b, fontSize: 14, color: '#fff' }}>{cur?.viewCount ?? 0} {tr('v3.viewsWord')}</Text>
            </View>
          </>
        ) : (
          <>
            <TextInput value={reply} onChangeText={setReply} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} placeholder={tr('v3.replyPh')} placeholderTextColor="rgba(255,255,255,.8)" accessibilityLabel={tr('v3.replyPh')}
              style={{ flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.7)', paddingHorizontal: 18, color: '#fff', fontFamily: font.s, fontSize: 14, outlineStyle: 'none' } as never} />
            <Pressable onPress={() => sendReply('heart')} accessibilityRole="button" accessibilityLabel={tr('v3.like')} hitSlop={8}><Icon name="heart" size={26} color={liked ? '#e83e63' : '#fff'} filled={liked} /></Pressable>
            <Pressable onPress={() => sendReply('reply')} disabled={!reply.trim()} accessibilityRole="button" accessibilityLabel={tr('v3.sendReply')} hitSlop={8} style={{ opacity: reply.trim() ? 1 : 0.6 }}><Icon name="send" size={26} color="#fff" /></Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
