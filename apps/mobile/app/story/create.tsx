import React, { useState } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Avatar, BackBar, Button, Chip, ChipRow, ListItem, Photo, T, Title } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Screen } from '@/components/ui';
import { ToastHost } from '@/components/ToastHost';
import { DEMO_IMG } from '@/demo/photos';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { pickImage, uploadPicked, type Picked } from '@/lib/pick';
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
  const params = useLocalSearchParams<{ kind?: string }>();
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { salon, demo, bump } = useApp();
  const sid = salon?.id ?? '';
  const [sel, setSel] = useState<Sel | null>(null);
  const [step, setStep] = useState<'pick' | 'edit'>('pick');
  const [text, setText] = useState('');
  const [svc, setSvc] = useState<{ id: string; name: string; price?: number } | null>(null);
  const [who, setWho] = useState<{ id: string; name: string; avatarUrl?: string } | null>(null);
  const [sheet, setSheet] = useState<'svc' | 'who' | null>(null);
  const [kind, setKind] = useState<'story' | 'post' | 'both'>(params.kind === 'post' ? 'post' : 'story');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
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
    if (busy) return;
    // Never a silent return: every refusal tells the user why (inline under the button, and a toast).
    const refuse = (m: string) => { setErr(m); toast(m, 'error'); };
    if (!sel) return refuse(tr('cp.noPhoto'));
    if (!sid) return refuse(tr('cp.noSalon'));
    setErr(''); setBusy(true);
    try {
      const caption = text.trim();
      const up = await uploadPicked(sel.picked, 'LOOK');               // POST /api/uploads (multipart file + purpose)
      if (!up?.id) throw new Error(tr('cp.photoLost'));
      if (kind !== 'post') await apiB.createStory(sid, up.id, caption);   // POST /businesses/{id}/stories {upload, caption}
      if (kind !== 'story') await apiB.createLook(sid, up.id, caption, { serviceId: svc?.id, staffId: who?.id }); // POST /businesses/{id}/looks
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); close(); setTimeout(() => toast(tr('cp.ok'), 'success'), 400);
    } catch (e) { const m = `${tr('cp.fail')}: ${(e as Error).message}`; setErr(m); toast(m, 'error'); } finally { setBusy(false); }
  }

  if (step === 'edit' && sel) {
    const pickRow = (label: string, value: string | undefined, on: () => void, clear: () => void) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, borderTopWidth: 1, borderTopColor: t.hair }}>
        <Pressable onPress={on} accessibilityRole="button" accessibilityLabel={label} noScale style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
          <T k="body">{label}</T>
          <T k="body" color={value ? t.vtext : t.muted} lines={1} style={{ maxWidth: '60%' }}>{value ?? tr('cp.none')}</T>
        </Pressable>
        {value ? <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} color={t.muted} /></Pressable> : null}
      </View>
    );
    const photoW = Math.min(W - 40, 420);
    return (
      <View style={{ flex: 1, backgroundColor: t.canvas }}>
        <View style={{ paddingTop: ins.top + 6, paddingHorizontal: 8, height: ins.top + 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setStep('pick')} accessibilityRole="button" accessibilityLabel={tr('v2.back')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={24} color={t.ink} /></Pressable>
          <T k="h3">{tr('cp.title')}</T>
          <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel={tr('cp.cancel')} style={{ minWidth: 44, height: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: font.s, fontSize: 15, color: t.muted }}>{tr('cp.cancel')}</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 14 }}>
          <Photo src={sel.src} style={{ width: photoW, height: photoW * 1.1, borderRadius: 22, alignSelf: 'center' }} />
          <View>
            <T k="sm" color={t.muted} style={{ marginBottom: 8 }}>{tr('cp.where')}</T>
            <ChipRow style={{ marginHorizontal: -20 }}>
              <Chip label={tr('cp.story')} on={kind === 'story'} onPress={() => setKind('story')} />
              <Chip label={tr('cp.post')} on={kind === 'post'} onPress={() => setKind('post')} />
              <Chip label={tr('cp.both')} on={kind === 'both'} onPress={() => setKind('both')} />
            </ChipRow>
            <T k="xs" color={t.muted} style={{ marginTop: 6 }}>{kind === 'post' ? tr('cp.postNote') : tr('cp.storyNote')}</T>
          </View>
          <TextInput value={text} onChangeText={(v) => { setText(v); setErr(''); }} placeholder={tr('cp.captionPh')} placeholderTextColor={t.muted} maxLength={200} multiline accessibilityLabel={tr('cp.captionPh')}
            style={{ minHeight: 80, borderRadius: 18, backgroundColor: t.fill, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontFamily: font.r, fontSize: 15, color: t.ink, textAlignVertical: 'top', outlineStyle: 'none' } as never} />
          <View>
            {pickRow(tr('cp.service'), svc?.name, () => setSheet('svc'), () => setSvc(null))}
            {pickRow(tr('cp.who'), who?.name, () => setSheet('who'), () => setWho(null))}
          </View>
        </ScrollView>
        <ToastHost modal />
        <View style={{ borderTopWidth: 1, borderTopColor: t.hair, backgroundColor: t.canvas, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(ins.bottom, 14) + 4, gap: 8 }}>
          {err ? <T k="sm" color={t.gink} style={{ textAlign: 'center' }} >{err}</T> : null}
          <Button label={tr('cp.share')} size="lg" block loading={busy} onPress={() => void share()} />
        </View>
        <BottomSheet open={sheet === 'svc'} onClose={() => setSheet(null)}>
          <T k="h1" style={{ marginBottom: 8 }}>{tr('cp.service')}</T>
          <ScrollView style={{ maxHeight: 360 }}>{(services.data ?? []).map((s, i) => <ListItem key={String(s.id)} first={i === 0} title={s.name} sub={money(s.price, salon?.currency)} onPress={() => { setSvc({ id: String(s.id), name: s.name, price: s.price }); setSheet(null); }} />)}</ScrollView>
        </BottomSheet>
        <BottomSheet open={sheet === 'who'} onClose={() => setSheet(null)}>
          <T k="h1" style={{ marginBottom: 8 }}>{tr('cp.who')}</T>
          <ScrollView style={{ maxHeight: 360 }}>{(staff.data ?? []).map((s, i) => <ListItem key={String(s.id)} first={i === 0} title={s.name} sub={s.position} lead={<Avatar uri={s.avatarUrl} name={s.name} size={40} />} onPress={() => { setWho({ id: String(s.id), name: s.name, avatarUrl: s.avatarUrl }); setSheet(null); }} />)}</ScrollView>
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
