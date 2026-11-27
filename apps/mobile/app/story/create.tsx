import React, { useState } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Avatar, BackBar, Button, Chip, ChipRow, CtaBar, ListItem, Photo, T, Title } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Screen } from '@/components/ui';
import { DEMO_IMG } from '@/demo/photos';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { pickImage, postStoryPicked, uploadPicked, type Picked } from '@/lib/pick';
import { useSafeAreaInsets } from '@/lib/insets';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Sel = { src: string; picked: Picked };

/** Story create: 1) pick a photo (camera, gallery, in demo the sample photos), 2) edit (text, service tag, specialist) and "Paylaş" (free). */
export default function StoryCreate() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { salon, demo, bump } = useApp();
  const sid = salon?.id ?? '';
  const [sel, setSel] = useState<Sel | null>(null);
  const [step, setStep] = useState<'pick' | 'edit'>('pick');
  const [text, setText] = useState('');
  const [editText, setEditText] = useState(false);
  const [svc, setSvc] = useState<{ name: string; price?: number } | null>(null);
  const [who, setWho] = useState<{ name: string; avatarUrl?: string } | null>(null);
  const [sheet, setSheet] = useState<'svc' | 'who' | null>(null);
  const [alsoLooks, setAlsoLooks] = useState(true);
  const [busy, setBusy] = useState(false);
  const services = useLoad(() => api.services(sid).catch(() => []), [sid]);
  const staff = useLoad(() => apiX.staffFull(sid).catch(() => []), [sid]);
  const looks = useLoad(() => (demo ? apiX.looks(sid).catch(() => []) : Promise.resolve([])), [sid, demo]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/looks'));
  const cell = (W - 2) / 3;
  const from = async (src: 'library' | 'camera') => {
    try { const p = await pickImage(src); if (p) { setSel({ src: p.uri, picked: p }); setStep('edit'); } }
    catch (e) { toast((e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message, 'error'); }
  };
  const demoPick = (url: string) => { setSel({ src: url, picked: { uri: url, name: 'story.jpg', type: 'image/jpeg' } }); setStep('edit'); };
  async function share() {
    if (!sel) return;
    setBusy(true);
    try {
      const caption = [text.trim(), svc ? `${svc.name}${svc.price != null ? ` · ${money(svc.price, salon?.currency)}` : ''}` : '', who ? `@${who.name.split(' ')[0]}` : ''].filter(Boolean).join(' · ');
      await postStoryPicked(sid, sel.picked, caption);
      if (alsoLooks) { const up = await uploadPicked(sel.picked, 'LOOK'); await apiB.createLook(sid, up.id); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(tr('ad.uploaded'), 'success'); bump(); close();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  if (step === 'edit' && sel) {
    const tool = (icon: string, label: string, on: () => void, txt?: string) => (
      <Pressable onPress={on} accessibilityRole="button" accessibilityLabel={label} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(29,23,48,.5)', alignItems: 'center', justifyContent: 'center' }}>
        {txt ? <Text style={{ fontFamily: font.b, fontSize: 16, color: '#fff' }}>{txt}</Text> : <Icon name={icon} size={22} color="#fff" />}
      </Pressable>
    );
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Photo src={sel.src} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        <View style={{ position: 'absolute', left: 8, top: ins.top + 10 }}>
          <Pressable onPress={() => setStep('pick')} accessibilityRole="button" accessibilityLabel={tr('v2.back')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={24} color="#fff" /></Pressable>
        </View>
        <View style={{ position: 'absolute', right: 14, top: ins.top + 10, gap: 10 }}>
          {tool('', tr('v3.addText'), () => setEditText(true), 'Aa')}
          {tool('tag', tr('v3.addService'), () => setSheet('svc'))}
          {tool('user', tr('v3.addWho'), () => setSheet('who'))}
        </View>
        {text || editText ? (
          <View style={{ position: 'absolute', left: 24, right: 80, top: '34%' }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
              <TextInput autoFocus={editText} value={text} onChangeText={setText} onBlur={() => setEditText(false)} placeholder={tr('v3.textPh')} placeholderTextColor="#8c8177" maxLength={60} accessibilityLabel={tr('v3.addText')}
                style={{ fontFamily: font.b, fontSize: 16, color: '#1d1730', minWidth: 120, outlineStyle: 'none' } as never} />
            </View>
          </View>
        ) : null}
        {svc ? (
          <Pressable onPress={() => setSvc(null)} accessibilityRole="button" accessibilityLabel={svc.name} style={{ position: 'absolute', left: 24, top: '48%', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, transform: [{ rotate: '-3deg' }] }}>
            <T k="xs" color="#8c8177">{tr('v3.serviceTag')}</T>
            <Text style={{ fontFamily: font.b, fontSize: 16, color: '#1d1730' }}>{svc.name}{svc.price != null ? ` · ${money(svc.price, salon?.currency)}` : ''}</Text>
            <Text style={{ fontFamily: font.b, fontSize: 13, color: '#5b3fd6', marginTop: 2 }}>{tr('v3.bookCta')} ›</Text>
          </Pressable>
        ) : null}
        {who ? (
          <Pressable onPress={() => setWho(null)} accessibilityRole="button" accessibilityLabel={who.name} style={{ position: 'absolute', right: 20, top: '58%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 20, paddingLeft: 5, paddingRight: 12, paddingVertical: 5 }}>
            <Avatar uri={who.avatarUrl} name={who.name} size={28} />
            <Text style={{ fontFamily: font.b, fontSize: 14, color: '#1d1730' }}>@{who.name.split(' ')[0]}</Text>
          </Pressable>
        ) : null}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(ins.bottom, 14) + 10, gap: 12, paddingHorizontal: 14 }}>
          <View style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(29,23,48,.6)', borderRadius: 20, paddingHorizontal: 14, height: 40 }}>
            <Icon name="eye" size={18} color="#fff" /><Text style={{ fontFamily: font.s, fontSize: 13.5, color: '#fff' }}>{tr('v3.seenIn')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: true }} accessibilityLabel={tr('v2.yourStory')} style={{ height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 23, backgroundColor: 'rgba(29,23,48,.6)' }}>
              <Avatar uri={(salon as { logoUrl?: string } | null)?.logoUrl} name={salon?.name} size={26} /><Text style={{ fontFamily: font.b, fontSize: 13.5, color: '#fff' }}>{tr('v3.yourStoryShort')}</Text>
            </Pressable>
            <Pressable onPress={() => setAlsoLooks((v) => !v)} accessibilityRole="button" accessibilityState={{ selected: alsoLooks }} accessibilityLabel={tr('v3.alsoLooks')} style={{ height: 46, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 23, backgroundColor: alsoLooks ? 'rgba(111,82,237,.85)' : 'rgba(29,23,48,.6)' }}>
              {alsoLooks ? <Icon name="check" size={16} color="#fff" /> : null}<Text style={{ fontFamily: font.b, fontSize: 13.5, color: '#fff' }}>{tr('v3.alsoLooks')}</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => void share()} disabled={busy} accessibilityRole="button" accessibilityLabel={tr('v2.share')} style={{ height: 50, borderRadius: 25, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', opacity: busy ? 0.6 : 1 }}>
              <Text style={{ fontFamily: font.b, fontSize: 16, color: '#1d1730' }}>{busy ? '…' : tr('v2.share')}</Text><Icon name="chev" size={16} color="#1d1730" />
            </Pressable>
          </View>
        </View>
        <BottomSheet open={sheet === 'svc'} onClose={() => setSheet(null)}>
          <T k="h1" style={{ marginBottom: 8 }}>{tr('v3.addService')}</T>
          <ScrollView style={{ maxHeight: 360 }}>{(services.data ?? []).map((s, i) => <ListItem key={String(s.id)} first={i === 0} title={s.name} sub={money(s.price, salon?.currency)} onPress={() => { setSvc({ name: s.name, price: s.price }); setSheet(null); }} />)}</ScrollView>
        </BottomSheet>
        <BottomSheet open={sheet === 'who'} onClose={() => setSheet(null)}>
          <T k="h1" style={{ marginBottom: 8 }}>{tr('v3.addWho')}</T>
          <ScrollView style={{ maxHeight: 360 }}>{(staff.data ?? []).map((s, i) => <ListItem key={String(s.id)} first={i === 0} title={s.name} sub={s.position} lead={<Avatar uri={s.avatarUrl} name={s.name} size={40} />} onPress={() => { setWho({ name: s.name, avatarUrl: s.avatarUrl }); setSheet(null); }} />)}</ScrollView>
        </BottomSheet>
      </View>
    );
  }

  const demoPhotos = demo ? [...(looks.data ?? []).map((l) => l.photoUrl), ...['f01', 'f02', 'f03', 'f04', 'f05'].map((k) => `demo:${k}`)].slice(0, 12) : [];
  return (
    <Screen style={{ paddingTop: ins.top }}>
      <BackBar label={tr('v2.close')} onBack={close} />
      <Title sub={tr('v3.newStoryHint')} style={{ paddingBottom: 12 }}>{tr('v3.newStory')}</Title>
      <ChipRow style={{ marginBottom: 12 }}><Chip label={tr('v3.recent')} on /><Chip label={tr('sections.views')} /></ChipRow>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 1, paddingBottom: 130 }}>
        <Pressable onPress={() => void from('camera')} accessibilityRole="button" accessibilityLabel={tr('ux.camera')} style={{ width: cell, height: cell * 1.33, backgroundColor: '#1d1730', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="cam" size={28} color="#fff" /><Text style={{ fontFamily: font.b, fontSize: 13, color: '#fff' }}>{tr('ux.camera')}</Text>
        </Pressable>
        <Pressable onPress={() => void from('library')} accessibilityRole="button" accessibilityLabel={tr('ux.gallery')} style={{ width: cell, height: cell * 1.33, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="img" size={28} color={t.vtext} /><Text style={{ fontFamily: font.b, fontSize: 13, color: t.vtext }}>{tr('ux.gallery')}</Text>
        </Pressable>
        {demoPhotos.map((u) => (
          <Pressable key={u} onPress={() => demoPick(u)} noScale accessibilityRole="imagebutton" accessibilityLabel={tr('v3.pickPhoto')}>
            <Photo src={u} style={{ width: cell, height: cell * 1.33 }} />
          </Pressable>
        ))}
      </ScrollView>
      {!demo ? <View style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(ins.bottom, 14) + 20 }}><T k="sm" color={t.muted} style={{ textAlign: 'center' }}>{tr('v3.pickHint')}</T></View> : null}
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
