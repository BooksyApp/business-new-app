import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { DragChip } from '@/components/DragChip';
import { Icon } from '@/components/Icon';
import { PhotoCropper, type CropShape, type CropView, type Sized } from '@/components/PhotoCropper';
import { Avatar, BackBar, Button, Chip, ChipRow, CtaBar, ListItem, Photo, T, Title } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { fitRect } from '@/components/TagLayer';
import { Screen } from '@/components/ui';
import { ToastHost } from '@/components/ToastHost';
import { DEMO_IMG } from '@/demo/photos';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { money } from '@/lib/format';
import { photoSource } from '@/lib/photo';
import { pickImage, postStoryPicked, uploadPicked, type Picked } from '@/lib/pick';
import { useSafeAreaInsets } from '@/lib/insets';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Sel = { src: string; picked: Picked };

/** Story create: 1) pick a photo (camera, gallery, in demo the sample photos), 2) frame it (pinch / drag / shape; skipped when the size is unknown), 3) edit (text, service tag, specialist) and "Paylaş" (free). */
export default function StoryCreate() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { salon, demo, bump } = useApp();
  const sid = salon?.id ?? '';
  const [sel, setSel] = useState<Sel | null>(null);
  const [step, setStep] = useState<'pick' | 'crop' | 'edit'>('pick');
  const [orig, setOrig] = useState<Sized | null>(null);
  const [shape, setShape] = useState<CropShape>('4:5');
  const view = useRef<CropView | undefined>(undefined);
  const [arFb, setArFb] = useState(0);
  const [text, setText] = useState('');
  const [editText, setEditText] = useState(false);
  const [svc, setSvc] = useState<{ id?: string | number; name: string; price?: number } | null>(null);
  const [who, setWho] = useState<{ id?: string | number; name: string; avatarUrl?: string } | null>(null);
  const [sheet, setSheet] = useState<'svc' | 'who' | null>(null);
  const [alsoLooks, setAlsoLooks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [err, setErr] = useState('');
  const pos = useRef<{ svc?: { x: number; y: number }; who?: { x: number; y: number } }>({});
  const services = useLoad(() => api.services(sid).catch(() => []), [sid]);
  const staff = useLoad(() => apiX.staffFull(sid).catch(() => []), [sid]);
  const looks = useLoad(() => (demo ? apiX.looks(sid).catch(() => []) : Promise.resolve([])), [sid, demo]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/looks'));
  const cell = (W - 2) / 3;
  /** pick -> crop when the real pixel size is known and the photo is a loadable uri; otherwise straight to edit (demo assets, odd sources). */
  const begin = async (p: Picked, uri: string) => {
    view.current = undefined; pos.current = {};
    setShape(alsoLooks ? '4:5' : '9:16'); // a post kept on the profile is a portrait 4:5, a story-only photo fills the 9:16 screen
    let w = p.width ?? 0; let h = p.height ?? 0;
    if (!(w > 0 && h > 0) && uri) {
      const sz = await new Promise<{ w: number; h: number } | null>((res) => { Image.getSize(uri, (a, b) => res({ w: a, h: b }), () => res(null)); });
      if (sz) { w = sz.w; h = sz.h; }
    }
    setSel({ src: p.uri, picked: p });
    if (w > 0 && h > 0 && uri) { setOrig({ ...p, uri, width: w, height: h }); setStep('crop'); } else { setOrig(null); setStep('edit'); }
  };
  const from = async (src: 'library' | 'camera') => {
    try { const p = await pickImage(src); if (p) await begin(p, p.uri); }
    catch (e) { toast((e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message, 'error'); }
  };
  const demoPick = (url: string) => {
    const ps = photoSource(url);
    const uri = ps && typeof ps === 'object' && 'uri' in ps ? String((ps as { uri?: string }).uri ?? '') : '';
    void begin({ uri: url, name: 'story.jpg', type: 'image/jpeg' }, uri);
  };
  const photoAr = sel?.picked.width && sel.picked.height ? sel.picked.width / sel.picked.height : arFb;
  useEffect(() => {
    setArFb(0);
    if (!sel || (sel.picked.width && sel.picked.height)) return;
    const ps = photoSource(sel.src);
    const u = ps && typeof ps === 'object' && 'uri' in ps ? String((ps as { uri?: string }).uri ?? '') : '';
    if (u) Image.getSize(u, (w, h) => { if (w > 0 && h > 0) setArFb(w / h); }, () => {});
  }, [sel]);
  async function share() {
    if (busy) return;
    const refuse = (m: string) => { setErr(m); toast(m, 'error'); };
    if (!sel) return refuse(tr('cp.noPhoto'));
    if (!sid) return refuse(tr('cp.noSalon'));
    setErr(''); setBusy(true);
    try {
      const svcLabel = svc ? `${svc.name}${svc.price != null ? ` · ${money(svc.price, salon?.currency)}` : ''}` : '';
      const tagList = [svc ? { k: 'svc', t: svcLabel, ...(pos.current.svc ?? { x: 0.04, y: 0.7 }) } : null, who ? { k: 'who', t: `@${who.name.split(' ')[0]}`, ...(pos.current.who ?? { x: 0.04, y: 0.64 }) } : null].filter(Boolean);
      const tags = tagList.length ? JSON.stringify(tagList) : undefined;
      await postStoryPicked(sid, sel.picked, text.trim(), tags);
      if (alsoLooks) { const up = await uploadPicked(sel.picked, 'LOOK'); await apiB.createLook(sid, up.id, text.trim(), { serviceId: svc?.id != null ? String(svc.id) : undefined, staffId: who?.id != null ? String(who.id) : undefined, tags }); }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); setDone(true);
      setTimeout(() => { close(); setTimeout(() => { bump(); toast(tr('cp.ok'), 'success'); }, 350); }, 900);
    } catch (e) { const m = `${tr('cp.fail')}: ${(e as Error).message}`; setErr(m); toast(m, 'error'); } finally { setBusy(false); }
  }

  // DragChips live in a layer that sits exactly on the visible photo (contain-fit of the cropped image inside the screen), so the saved 0..1 are of the photo.
  const pr = fitRect(box.w, box.h, photoAr);
  const uiBottom = Math.max(ins.bottom, 14) + 10 + 54 + 10 + 58 + 10 + 44;
  const bounds = { w: pr.w, h: pr.h, top: Math.max(8, ins.top + 72 - pr.y), bottom: Math.max(8, uiBottom - (box.h - pr.y - pr.h)), toolX: box.w - 70 - pr.x, toolBottom: ins.top + 172 - pr.y };
  if (step === 'crop' && orig) {
    return (
      <PhotoCropper photo={orig} shape={shape} initial={view.current} softFail={demo}
        onShape={(s2) => { view.current = undefined; setShape(s2); }}
        onView={(v) => { view.current = v; }}
        onBack={() => { setSel(null); setOrig(null); setStep('pick'); }}
        onDone={(c, v) => { view.current = v; pos.current = {}; setSel({ src: c.uri, picked: c }); setStep('edit'); }} />
    );
  }
  if (step === 'edit' && sel) {
    const tool = (icon: string, label: string, on: () => void, txt?: string) => (
      <Pressable onPress={on} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(29,23,48,.5)', alignItems: 'center', justifyContent: 'center' }}>
        {txt ? <Text style={{ fontFamily: font.b, fontSize: 16, color: '#fff' }}>{txt}</Text> : <Icon name={icon} size={22} color="#fff" />}
      </Pressable>
    );
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Photo src={sel.src} fit="contain" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#000' }} />
        <View style={{ position: 'absolute', left: 14, top: ins.top + 10, zIndex: 20, elevation: 20 }}>
          <Pressable onPress={() => { if (orig) { setStep('crop'); return; } setSel(null); setSvc(null); setWho(null); setText(''); setStep('pick'); }} hitSlop={10} accessibilityRole="button" accessibilityLabel={orig ? tr('common.back') : tr('v2.close')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(29,23,48,.5)', alignItems: 'center', justifyContent: 'center' }}><Icon name={orig ? 'back' : 'x'} size={22} color="#fff" /></Pressable>
        </View>
        {text || editText ? (
          <View style={{ position: 'absolute', left: 24, right: 80, top: '34%' }}>
            <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
              <TextInput autoFocus={editText} value={text} onChangeText={setText} onBlur={() => setEditText(false)} placeholder={tr('v3.textPh')} placeholderTextColor="#8c8177" maxLength={60} accessibilityLabel={tr('v3.addText')}
                style={{ fontFamily: font.b, fontSize: 16, color: '#1d1730', minWidth: 120, outlineStyle: 'none' } as never} />
            </View>
          </View>
        ) : null}
        {svc || who ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', left: pr.x, top: pr.y, width: pr.w, height: pr.h, zIndex: 5, elevation: 5 }}>
            {svc ? (
              <DragChip bounds={bounds} slot={0} label={svc.name} onPress={() => setSheet('svc')} onRemove={() => setSvc(null)} onMove={(x, y) => { pos.current.svc = { x, y }; }}>
                <Icon name="tag" size={14} color="#5b3fd6" />
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.b, fontSize: 13.5, color: '#1d1730' }}>{svc.name}{svc.price != null ? ` · ${money(svc.price, salon?.currency)}` : ''}</Text>
              </DragChip>
            ) : null}
            {who ? (
              <DragChip bounds={bounds} slot={svc ? 1 : 0} label={who.name} onPress={() => setSheet('who')} onRemove={() => setWho(null)} onMove={(x, y) => { pos.current.who = { x, y }; }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.b, fontSize: 13.5, color: '#1d1730' }}>@{who.name.split(' ')[0]}</Text>
              </DragChip>
            ) : null}
          </View>
        ) : null}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(ins.bottom, 14) + 10, gap: 10, paddingHorizontal: 16, zIndex: 20, elevation: 20 }}>
          <Pressable onPress={() => setAlsoLooks((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: alsoLooks }} accessibilityLabel={tr('v3.keepTitle')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(29,23,48,.62)', borderRadius: 20, paddingHorizontal: 14, height: 58 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14, color: '#fff' }}>{tr('v3.keepTitle')}</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 12, color: 'rgba(255,255,255,.78)' }}>{alsoLooks ? tr('v3.keepOn') : tr('v3.keepOff')}</Text>
            </View>
            <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: alsoLooks ? '#6f52ed' : 'rgba(255,255,255,.3)', padding: 3, alignItems: alsoLooks ? 'flex-end' : 'flex-start' }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' }} /></View>
          </Pressable>
          {err ? <View style={{ alignSelf: 'center', backgroundColor: 'rgba(232,62,99,.95)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ fontFamily: font.s, fontSize: 13, color: '#fff', textAlign: 'center' }}>{err}</Text></View> : null}
          <Pressable onPress={() => void share()} disabled={busy} accessibilityRole="button" accessibilityLabel={tr('cp.share')} style={{ height: 54, borderRadius: 27, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', opacity: busy ? 0.85 : 1 }}>
            {busy ? <ActivityIndicator color="#1d1730" /> : null}
            <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 16, color: '#1d1730' }}>{busy ? tr('cp.sharing') : tr('cp.share')}</Text>
          </Pressable>
        </View>
        {/* Tool column: its own layer, rendered after every other overlay (tag layer, text, bottom bar) so it is always the top-most touch target. */}
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 0, top: ins.top + 10, paddingRight: 14, paddingLeft: 12, paddingBottom: 12, gap: 10, zIndex: 60, elevation: 60 }}>
          {tool('', tr('v3.addText'), () => setEditText(true), 'Aa')}
          {tool('tag', tr('v3.addService'), () => setSheet('svc'))}
          {tool('user', tr('v3.addWho'), () => setSheet('who'))}
        </View>
        {done ? (
          <View pointerEvents="auto" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, elevation: 50, backgroundColor: 'rgba(29,23,48,.72)', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#6f52ed', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={38} color="#fff" /></View>
            <Text style={{ fontFamily: font.x, fontSize: 24, color: '#fff' }}>{tr('cp.ok')}</Text>
          </View>
        ) : null}
        <ToastHost modal />
        <BottomSheet open={sheet === 'svc'} onClose={() => setSheet(null)}>
          <T k="h1" style={{ marginBottom: 8 }}>{tr('v3.addService')}</T>
          {services.loading && !services.data ? <ActivityIndicator style={{ paddingVertical: 28 }} color={t.vtext} /> : null}
          {!services.loading && !(services.data ?? []).length ? (
            <View style={{ paddingVertical: 20, gap: 14, alignItems: 'center' }}>
              <Text style={{ fontFamily: font.s, fontSize: 15, color: t.muted }}>{tr('v3.noSvc')}</Text>
              <Button label={tr('v3.toSvc')} kind="ol" onPress={() => { setSheet(null); router.push('/section/services'); }} />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 360 }}>{(services.data ?? []).map((s, i) => <ListItem key={String(s.id)} first={i === 0} title={s.name} sub={money(s.price, salon?.currency)} onPress={() => { setSvc({ id: s.id, name: s.name, price: s.price }); setSheet(null); }} />)}</ScrollView>
        </BottomSheet>
        <BottomSheet open={sheet === 'who'} onClose={() => setSheet(null)}>
          <T k="h1" style={{ marginBottom: 8 }}>{tr('v3.addWho')}</T>
          <ScrollView style={{ maxHeight: 360 }}>{(staff.data ?? []).map((s, i) => <ListItem key={String(s.id)} first={i === 0} title={s.name} sub={s.position} lead={<Avatar uri={s.avatarUrl} name={s.name} size={40} />} onPress={() => { setWho({ id: s.id, name: s.name, avatarUrl: s.avatarUrl }); setSheet(null); }} />)}</ScrollView>
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
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
