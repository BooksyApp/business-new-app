import React from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Avatar, Button, IconBtn, Photo, Skeleton, StoryBubble, T, TopBar } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { useDockInset } from '@/lib/dock';
import { useSafeAreaInsets } from '@/lib/insets';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/**
 * Görünüşlər (artifact "Görünüşlər"): the salon's Instagram-like profile. Own story, three numbers, two buttons,
 * category highlights, a 3-column grid. Posting and the story/photo manager stay in the existing Looks screen
 * (/section/views) until the story editor wave.
 */
export default function LooksTab() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const inset = useDockInset(16);
  const { salon, version } = useApp();
  const sid = salon?.id ?? '';
  const looks = useLoad(() => apiX.looks(sid), [sid, version]);
  const stories = useLoad(() => apiX.stories(sid).catch(() => []), [sid, version]);
  const sum = useLoad(() => apiX.reviewSummary(sid).catch(() => null), [sid, version]);
  const services = useLoad(() => api.services(sid).catch(() => []), [sid]);
  const list = looks.data ?? [];
  const own = (stories.data ?? []).length > 0;
  const manage = () => router.push('/section/views');
  const addStory = () => router.push('/story/create');
  const openStory = () => router.push('/story/view?mode=own');
  const cats = [...new Set((services.data ?? []).map((s) => s.categoryName).filter(Boolean) as string[])].slice(0, 5);
  const hl = cats.map((c, i) => ({ c, photo: (services.data ?? []).find((s) => s.categoryName === c && (s as { imageUrl?: string }).imageUrl) as { imageUrl?: string } | undefined, i }));
  const cell = (W - 4) / 3;
  const views = list.reduce((n, l) => n + ((l as { views?: number }).views ?? 0), 0);
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}K` : String(n));

  return (
    <Screen style={{ paddingTop: ins.top }}>
      <TopBar title={tr('v2.looksTitle')} right={<><IconBtn icon="plus" label={tr('v2.storyAdd')} onPress={addStory} /><IconBtn icon="gear" label={tr('sections.views')} onPress={manage} /></>} />
      <ScrollView contentContainerStyle={{ paddingBottom: inset }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={looks.refreshing} onRefresh={() => void looks.reload()} tintColor={t.violet} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 20, paddingTop: 6 }}>
          <StoryBubble size={86} uri={(salon as { logoUrl?: string } | null)?.logoUrl} name={salon?.name} label="" add={!own} onPress={own ? openStory : addStory} />
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {([[String(list.length), tr('v2.posts')], [views ? fmt(views) : '0', tr('v2.viewsMonth')], [sum.data?.average ? String(sum.data.average.toFixed(1)).replace('.', ',') : '–', tr('v2.rating')]] as const).map(([v, l]) => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, fontVariant: ['tabular-nums'] }}>{v}</Text>
                <T k="sm" color={t.muted} style={{ fontSize: 12 }}>{l}</T>
              </View>
            ))}
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <T k="h2" style={{ fontSize: 15 }}>{salon?.name}</T>
          <T k="sm" color={t.muted}>{[cats.slice(0, 3).join(' · ').toLowerCase(), salon?.address].filter(Boolean).join(' · ')}</T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button size="sm" kind="fl" label={tr('v2.editProfile')} style={{ flex: 1, height: 38 }} onPress={() => router.push('/section/profile')} />
            <Button size="sm" kind="fl" label={tr('v2.storyAdd')} style={{ flex: 1, height: 38 }} onPress={addStory} />
          </View>
        </View>
        {list.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 14 }}>
            {hl.map((h) => (
              <Pressable key={h.c} onPress={manage} accessibilityRole="button" accessibilityLabel={h.c} style={{ width: 62, alignItems: 'center' }}>
                <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: t.hair, padding: 3, backgroundColor: t.canvas }}>
                  <Avatar uri={h.photo?.imageUrl ?? list[h.i % list.length]?.photoUrl} name={h.c} size={54} />
                </View>
                <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 11.5, color: t.ink, marginTop: 5 }}>{h.c}</Text>
              </Pressable>
            ))}
            <Pressable onPress={manage} accessibilityRole="button" accessibilityLabel={tr('v2.newHl')} style={{ width: 62, alignItems: 'center' }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: t.hair, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={22} color={t.ink} /></View>
              <Text style={{ fontFamily: font.r, fontSize: 11.5, color: t.ink, marginTop: 5 }}>{tr('v2.newHl')}</Text>
            </Pressable>
          </ScrollView>
        ) : null}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.hair, marginTop: 14 }}>
          {['grid', 'tag', 'bookmark'].map((i, k) => (
            <View key={i} style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: k === 0 ? 1.5 : 0, borderBottomColor: t.ink, marginBottom: -1 }}>
              <Icon name={i} size={22} color={k === 0 ? t.ink : t.ink3} />
            </View>
          ))}
        </View>
        {looks.error ? <ErrorState error={looks.error} onRetry={() => void looks.reload()} /> : looks.loading && !looks.data ? <Skeleton blocks={[{ h: cell * 1.25, r: 0 }, { h: cell * 1.25, r: 0 }]} /> : list.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
            {list.map((l, i) => (
              <Pressable key={String(l.id)} onPress={() => router.push(`/post/${l.id}`)} noScale accessibilityRole="imagebutton" accessibilityLabel={l.title ?? l.serviceName ?? ''}>
                <Photo src={l.photoUrl} style={{ width: cell, height: cell * 1.25 }}>
                  {i % 4 === 1 ? <View style={{ position: 'absolute', top: 7, right: 7 }}><Icon name="img" filled size={16} color="#fff" /></View> : null}
                </Photo>
              </Pressable>
            ))}
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>{Array.from({ length: 6 }, (_, i) => <View key={i} style={{ width: cell, height: cell * 1.25, backgroundColor: t.fill }} />)}</View>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, backgroundColor: 'rgba(251,247,242,.75)' }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: t.ink, alignItems: 'center', justifyContent: 'center' }}><Icon name="cam" size={24} color={t.ink} /></View>
              <T k="h2" style={{ fontSize: 18, marginTop: 12, textAlign: 'center' }}>{tr('v2.firstWorkTitle')}</T>
              <T k="sm" color={t.muted} style={{ textAlign: 'center', marginTop: 4, marginBottom: 14 }}>{tr('v2.firstWorkBody')}</T>
              <Button icon="plus" label={tr('v2.firstStory')} onPress={addStory} />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
