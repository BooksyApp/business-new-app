import { useState } from 'react';
import { photoSource } from '@/lib/photo';
import { toast } from '@/lib/toast';
import { Alert, FlatList, Image, RefreshControl, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Chip, ErrorState, Field, Header, Pill, Screen, ServiceThumb, Skeleton, StateView, photoUrl } from '@/components/ui';
import { BackBar, Chip as KChip, ChipRow, EmptyState, IconBtn, Photo as KPhoto, Pill as KPill, Skeleton as KSkel, Title } from '@/components/kit';
import { useRouter } from 'expo-router';
import { t as tr } from '@/i18n';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { pickImage, postStoryPicked, uploadPicked, type Picked } from '@/lib/pick';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Görünüşlər: the salon portfolio (looks) and 24h stories - review and remove; uploading stays in the web panel. */
export function Looks({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const router = useRouter();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [tab, setTab] = useState<'photos' | 'stories'>('photos');
  const list = useLoad(async () => (tab === 'photos' ? (await apiX.looks(sid)).map((l) => ({ id: l.id, url: l.photoUrl, cap: l.title ?? l.serviceName ?? '', tag: l.status, views: null as number | null })) : (await apiX.stories(sid)).map((s) => ({ id: s.id, url: s.url, cap: s.caption ?? '', tag: '', views: s.viewCount }))), [sid, tab]);
  const [upBusy, setUpBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<Picked | null>(null);
  const [cap, setCap] = useState('');
  const [err, setErr] = useState('');
  async function choose(src: 'library' | 'camera') {
    try { const p = await pickImage(src); if (p) setPick(p); }
    catch (e) { toast((e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message, 'error'); }
  }
  async function send() {
    if (upBusy) return;
    if (!pick) { const m = tr('cp.noPhoto'); setErr(m); toast(m, 'error'); return; }
    setErr(''); setUpBusy(true);
    try {
      if (tab === 'photos') { const up = await uploadPicked(pick, 'LOOK'); await apiB.createLook(sid, up.id); }
      else await postStoryPicked(sid, pick, cap);
      setSheet(false); setPick(null); setCap(''); void list.reload();
      setTimeout(() => toast(tr('cp.ok'), 'success'), 350);
    } catch (e) { const m = `${tr('cp.fail')}: ${(e as Error).message}`; setErr(m); toast(m, 'error'); } finally { setUpBusy(false); }
  }
  const del = (id: string | number) => Alert.alert(tr('lk.confirmDelete'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => {
    void (tab === 'photos' ? apiX.deleteLook(sid, String(id)) : apiX.deleteStory(sid, String(id))).then(() => list.reload()).catch((e: Error) => toast(e.message, 'error'));
  } }]);
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} right={<IconBtn icon="plus" label={tab === 'photos' ? tr('ad.upload') : tr('ad.story')} onPress={() => { if (tab === 'stories') router.push('/story/create'); else { setPick(null); setErr(''); setSheet(true); } }} />} />
      <Title sub={salon?.name} style={{ paddingBottom: 12 }}>{tr('sections.views')}</Title>
      <ChipRow style={{ marginBottom: 12 }}>
        <KChip label={tr('lk.photos')} on={tab === 'photos'} onPress={() => setTab('photos')} />
        <KChip label={tr('lk.stories')} on={tab === 'stories'} onPress={() => setTab('stories')} />
      </ChipRow>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <KSkel blocks={[{ h: 160, r: 0 }, { h: 160, r: 0 }]} /> : (
        <FlatList data={list.data ?? []} numColumns={3} keyExtractor={(x) => String(x.id)} columnWrapperStyle={{ gap: 2 }} contentContainerStyle={{ paddingBottom: 60, gap: 2 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListEmptyComponent={<EmptyState photo="demo:f03" title={tr('lk.empty')} body={tr('v2.firstWorkBody')} action={{ label: tab === 'photos' ? tr('ad.upload') : tr('ad.story'), icon: 'plus', onPress: () => { if (tab === 'stories') router.push('/story/create'); else { setPick(null); setErr(''); setSheet(true); } } }} />}
          renderItem={({ item: x, index }) => (
            <Pressable onPress={() => (tab === 'photos' ? router.push(`/post/${x.id}`) : router.push(`/story/view?mode=own&i=${index}`))} onLongPress={() => del(x.id)} noScale accessibilityRole="imagebutton" accessibilityLabel={x.cap || tr('lk.photos')} style={{ flex: 1 / 3 }}>
              <KPhoto src={x.url} style={{ width: '100%', aspectRatio: 0.8 }}>
                {x.tag && !/approved|live|published/i.test(x.tag) ? <View style={{ position: 'absolute', left: 6, top: 6 }}><KPill tone={/rejected/i.test(x.tag) ? 'g' : 'wh'} text={tr(`lk.${/rejected/i.test(x.tag) ? 'rejected' : 'pending'}` as 'lk.pending')} /></View> : null}
                {x.views != null ? <View style={{ position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="eye" size={14} color="#fff" /><Text style={{ fontFamily: font.b, fontSize: 12, color: '#fff' }}>{x.views}</Text></View> : null}
              </KPhoto>
            </Pressable>
          )} />
      )}
      <BottomSheet open={sheet} onClose={() => { setSheet(false); setPick(null); }}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{tab === 'photos' ? tr('ad.upload') : tr('ad.story')}</Text>
        {pick ? (
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <Image source={{ uri: pick.uri }} accessibilityIgnoresInvertColors style={{ width: '100%', aspectRatio: 1, borderRadius: 26, backgroundColor: t.fill }} />
            {tab === 'stories' ? <Field label={tr('lk.stories')} value={cap} onChangeText={setCap} /> : null}
            {err ? <Text style={{ fontFamily: font.s, fontSize: 13.5, color: t.gink, textAlign: 'center' }}>{err}</Text> : null}
            <Btn label={tr('cp.share')} loading={upBusy} onPress={() => void send()} />
            <Pressable onPress={() => { setPick(null); setErr(''); }} disabled={upBusy} accessibilityRole="button" accessibilityLabel={tr('cp.change')} style={{ alignSelf: 'center', paddingVertical: 6 }}><Text style={{ fontFamily: font.s, fontSize: 14.5, color: t.muted }}>{tr('cp.change')}</Text></Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, paddingBottom: 20 }}>
            {([['library', 'img', tr('ux.gallery')], ['camera', 'cam', tr('ux.camera')]] as const).map(([k, ic, label]) => (
              <Pressable key={k} onPress={() => void choose(k)} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, height: 132, borderRadius: 28, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Icon name={ic} size={34} color={t.vtext} /><Text style={{ fontFamily: font.x, fontSize: 17, color: t.vtext }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </BottomSheet>
    </Screen>
  );
}
