import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackBar, BarRow, Button, Card, Photo, Pill, T } from '@/components/kit';
import { Text } from '@/components/Text';
import { PromoteSheet } from '@/components/PromoteSheet';
import { Screen } from '@/components/ui';
import { t as tr } from '@/i18n';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type LookX = { id: string | number; photoUrl: string; saveCount?: number; views?: number };

/** Post statistics: four numbers, last-7-days bars, where it was seen, and the optional paid-ad card ("Reklam et", UI only). Numbers show "–" when the API sends none. */
export default function PostStats() {
  const { t } = useTheme();
  const router = useRouter();
  const { salon, demo } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const looks = useLoad(() => apiX.looks(salon?.id ?? ''), [salon?.id]);
  const l = (looks.data as LookX[] | null)?.find((x) => String(x.id) === String(id));
  const [promo, setPromo] = useState(false);
  const f = (n?: number) => (n == null ? '–' : n.toLocaleString('az').replace(/,/g, ' '));
  const secondary = l?.views;
  return (
    <Screen>
      <BackBar label={tr('v3.post')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/looks'))} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 8 }}>
          <Photo src={l?.photoUrl} style={{ width: 66, height: 90, borderRadius: 14 }} />
          <View style={{ flex: 1 }}><T k="h1">{tr('v3.stats')}</T><T k="sm" color={t.muted}>{demo ? tr('v3.sampleNums') : tr('v3.last30')}</T></View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginTop: 8 }}>
          {([[tr('v3.sSaves'), l?.saveCount, true], [tr('v3.sViews'), secondary, false]] as [string, number | undefined, boolean][]).filter(([, v, main]) => main || v != null).map(([k, v, main]) => (
            <Card key={k} style={{ width: main ? '100%' : '47.5%', flexGrow: 1, padding: 14, gap: 2 }}><T k="sm" color={t.muted}>{k}</T><Text style={{ fontFamily: font.b, fontSize: main ? 32 : 20, letterSpacing: -0.5, color: t.ink }}>{f(v)}</Text></Card>
          ))}
        </View>
        <Card style={{ marginHorizontal: 20, marginTop: 22, padding: 16, gap: 8 }}>
          <Pill icon="tag" text={tr('v3.paidOptional')} />
          <T k="h3" style={{ marginTop: 4 }}>{tr('v3.promoteTitle')}</T>
          <T k="sm" color={t.muted}>{tr('v3.promoteBody')}</T>
          <Button kind="dk" label={tr('v3.adTitle')} onPress={() => setPromo(true)} style={{ marginTop: 6 }} />
        </Card>
      </ScrollView>
      <PromoteSheet open={promo} onClose={() => setPromo(false)} />
    </Screen>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
