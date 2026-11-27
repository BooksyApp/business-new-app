import React from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '@/components/Icon';
import { Avatar, BackBar, Button, Card, IconBtn, Photo, Skeleton, T } from '@/components/kit';
import { Text } from '@/components/Text';
import { TagLayer, parseTags } from '@/components/TagLayer';
import { ErrorState, Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { toast } from '@/lib/toast';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type LookX = { id: string | number; photoUrl: string; title?: string | null; serviceName?: string | null; staffName?: string | null; tags?: string | null; saveCount?: number };

/** Post view: header, big photo, counts + "Statistika", caption, service chip and how clients see the booking prompt. */
export default function PostView() {
  const { t } = useTheme();
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const { salon, bump } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sid = salon?.id ?? '';
  const looks = useLoad(() => apiX.looks(sid), [sid]);
  const l = (looks.data as LookX[] | null)?.find((x) => String(x.id) === String(id));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/looks'));
  const del = () => Alert.alert(tr('lk.confirmDelete'), undefined, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('lk.delete'), style: 'destructive', onPress: () => { void apiX.deleteLook(sid, String(id)).then(() => { bump(); back(); }).catch((e: Error) => toast(e.message, 'error')); } }]);
  return (
    <Screen>
      <BackBar label={tr('v2.looksTitle')} onBack={back} right={<IconBtn icon="dots" label={tr('lk.delete')} onPress={del} />} />
      {looks.error && !looks.data ? <ErrorState error={looks.error} onRetry={() => void looks.reload()} /> : looks.loading && !looks.data ? <Skeleton blocks={[{ h: 50 }, { h: W * 1.2, r: 0 }]} /> : !l ? <ErrorState error={new Error(tr('state.errorTitle'))} onRetry={() => void looks.reload()} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Avatar uri={(salon as { logoUrl?: string } | null)?.logoUrl} name={salon?.name} size={36} />
            <View style={{ flex: 1 }}><T k="h3" lines={1}>{salon?.name}</T>{l.serviceName ? <T k="xs" color={t.muted}>{l.serviceName}</T> : null}</View>
          </View>
          <Photo src={l.photoUrl} style={{ width: W, height: W * 1.2 }} label={l.title ?? undefined}>
            {parseTags(l.tags).length ? <TagLayer tags={parseTags(l.tags)} w={W} h={W * 1.2} /> : l.serviceName || l.staffName ? (
              <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {l.serviceName ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, height: 32, paddingHorizontal: 12, maxWidth: '75%' }}><Icon name="tag" size={14} color="#5b3fd6" /><Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.b, fontSize: 13.5, color: '#1d1730' }}>{l.serviceName}</Text></View> : null}
                {l.staffName ? <View style={{ backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 16, height: 32, paddingHorizontal: 12, justifyContent: 'center' }}><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 13.5, color: '#1d1730' }}>@{l.staffName.split(' ')[0]}</Text></View> : null}
              </View>
            ) : null}
          </Photo>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 }}>
            <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{l.saveCount != null ? `${l.saveCount} ${tr('v3.likesWord')}` : tr('v3.noCounts')}</Text>
            <Button kind="ghost" size="sm" label={tr('v3.stats')} onPress={() => router.push(`/post-stats/${l.id}`)} style={{ paddingHorizontal: 0 }} />
          </View>
          {l.title ? <T k="body" style={{ paddingHorizontal: 20, marginTop: 4 }}><Text style={{ fontFamily: font.b }}>{(salon?.name ?? '').split(' ')[0].toLowerCase()}</Text> {l.title}</T> : null}
          <Card style={{ marginHorizontal: 20, marginTop: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}><T k="xs" color={t.ink3}>{tr('v3.clientsSee')}</T><T k="h3">{tr('v3.bookThisLook')}</T></View>
            <Button size="sm" label={tr('v3.bookCta')} onPress={() => router.push('/booking/new')} />
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
