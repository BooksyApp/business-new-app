import { useState } from 'react';
import { Alert, FlatList, Image, RefreshControl, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Chip, ErrorState, Header, Pill, Screen, Skeleton, StateView, photoUrl } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { pickAndPostStory, pickAndUpload } from '@/lib/pick';
import { Btn } from '@/components/ui';
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
  async function add() {
    setUpBusy(true);
    try {
      if (tab === 'photos') { const up = await pickAndUpload('LOOK'); if (up) { await apiB.createLook(sid, up.id); Alert.alert(tr('ad.uploaded')); void list.reload(); } }
      else if (await pickAndPostStory(sid, '')) { Alert.alert(tr('ad.uploaded')); void list.reload(); }
    } catch (e) { Alert.alert(tr('common.error'), (e as Error).message === 'permission' ? tr('ad.permission') : (e as Error).message); } finally { setUpBusy(false); }
  }
  const del = (id: string | number) => Alert.alert(tr('lk.confirmDelete'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => {
    void (tab === 'photos' ? apiX.deleteLook(sid, String(id)) : apiX.deleteStory(sid, String(id))).then(() => list.reload()).catch((e: Error) => Alert.alert(tr('common.error'), e.message));
  } }]);
  return (
    <Screen>
      <Header title={tr('sections.views')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        <Chip label={tr('lk.photos')} active={tab === 'photos'} onPress={() => setTab('photos')} />
        <Chip label={tr('lk.stories')} active={tab === 'stories'} onPress={() => setTab('stories')} />
      </View>
      {list.error && !list.data ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={3} height={160} /> : (
        <FlatList data={list.data ?? []} numColumns={2} keyExtractor={(x) => String(x.id)} columnWrapperStyle={{ gap: 10 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.reload()} tintColor={t.violet} />}
          ListHeaderComponent={<Btn label={tab === 'photos' ? tr('ad.upload') : tr('ad.story')} icon="plus" variant="secondary" loading={upBusy} onPress={() => void add()} style={{ marginBottom: 10 }} />}
          ListEmptyComponent={<StateView icon="img" title={tr('lk.empty')} />}
          renderItem={({ item: x }) => (
            <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden', backgroundColor: t.surface }}>
              <Image source={{ uri: photoUrl(x.url) ?? undefined }} style={{ width: '100%', aspectRatio: 0.85, backgroundColor: t.fill }} accessibilityLabel={x.cap || undefined} />
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
    </Screen>
  );
}
