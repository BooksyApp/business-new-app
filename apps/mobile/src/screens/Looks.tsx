import { photoSource } from '@/lib/photo';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, FlatList, Image, RefreshControl, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Chip, ErrorState, Field, Header, Pill, Screen, ServiceThumb, Skeleton, StateView, photoUrl } from '@/components/ui';
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
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const [tab, setTab] = useState<'photos' | 'stories'>('photos');
  const list = useLoad(async () => (tab === 'photos' ? (await apiX.looks(sid)).map((l) => ({ id: l.id, url: l.photoUrl, cap: l.title ?? l.serviceName ?? '', tag: l.status, views: null as number | null })) : (await apiX.stories(sid)).map((s) => ({ id: s.id, url: s.url, cap: s.caption ?? '', tag: '', views: s.viewCount }))), [sid, tab]);
  const [upBusy, setUpBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<Picked | null>(null);
  const [cap, setCap] = useState('');
  async function choose(src: 'library' | 'camera') {
    try { const p = await pickImage(src); if (p) setPick(p); }
    catch (e) { toast((e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message, 'error'); }
  }
  async function send() {
    if (!pick) return;
    setUpBusy(true);
    try {
      if (tab === 'photos') { const up = await uploadPicked(pick, 'LOOK'); await apiB.createLook(sid, up.id); }
      else await postStoryPicked(sid, pick, cap);
      toast(tr('ad.uploaded'), 'success'); setSheet(false); setPick(null); setCap(''); void list.reload();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setUpBusy(false); }
  }
  const del = (id: string | number) => Alert.alert(tr('lk.confirmDelete'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => {
    void (tab === 'photos' ? apiX.deleteLook(sid, String(id)) : apiX.deleteStory(sid, String(id))).then(() => list.reload()).catch((e: Error) => toast(e.message, 'error'));
  } }]);
  return (
    <Screen>
      <Header title={tr('sections.views')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 14 }}>
        <Chip label={tr('lk.photos')} active={tab === 'photos'} onPress={() => setTab('photos')} />
        <Chip label={tr('lk.stories')} active={tab === 'stories'} onPress={() => setTab('stories')} />
      </View>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} height={160} /> : (
        <FlatList data={list.data ?? []} numColumns={2} keyExtractor={(x) => String(x.id)} columnWrapperStyle={{ gap: 10 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={<Btn label={tab === 'photos' ? tr('ad.upload') : tr('ad.story')} icon="plus" variant="secondary" loading={upBusy} onPress={() => { setPick(null); setSheet(true); }} style={{ marginBottom: 10 }} />}
          ListEmptyComponent={<StateView icon="img" title={tr('lk.empty')} />}
          renderItem={({ item: x }) => (
            <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: t.surface }}>
              {photoSource(x.url) ? <Image source={photoSource(x.url)!} style={{ width: '100%', aspectRatio: 0.85, backgroundColor: t.fill }} accessibilityLabel={x.cap || undefined} /> : <View style={{ width: '100%', aspectRatio: 0.85, overflow: 'hidden' }}><ServiceThumb name={x.cap || 'look'} cat={x.cap} size={400} /></View>}
              <View style={{ padding: 8, gap: 4 }}>
                {x.cap ? <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 13, color: t.ink }}>{x.cap}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  {x.tag ? <Pill text={tr(`lk.${x.tag.toLowerCase() === 'rejected' ? 'rejected' : x.tag.toLowerCase() === 'approved' || x.tag.toLowerCase() === 'live' ? 'approved' : 'pending'}` as 'lk.pending')} tone={x.tag.toLowerCase() === 'rejected' ? 'guava' : 'muted'} /> : x.views != null ? <Text style={{ fontFamily: font.m, fontSize: 12, color: t.muted }}>{tr('lk.views', { n: x.views })}</Text> : <View />}
                  <Pressable onPress={() => del(x.id)} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Icon name="trash" size={20} color={t.gink} /></Pressable>
                </View>
              </View>
            </View>
          )} />
      )}
      <BottomSheet open={sheet} onClose={() => { setSheet(false); setPick(null); }}>
        <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink, marginBottom: 14 }}>{tab === 'photos' ? tr('ad.upload') : tr('ad.story')}</Text>
        {pick ? (
          <View style={{ gap: 12, paddingBottom: 16 }}>
            <Image source={{ uri: pick.uri }} accessibilityIgnoresInvertColors style={{ width: '100%', aspectRatio: 1, borderRadius: 26, backgroundColor: t.fill }} />
            {tab === 'stories' ? <Field label={tr('lk.stories')} value={cap} onChangeText={setCap} /> : null}
            <Btn label={tr('ux.uploadNow')} icon="check" loading={upBusy} onPress={() => void send()} />
            <Btn label={tr('ux.changePick')} variant="secondary" onPress={() => setPick(null)} />
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
