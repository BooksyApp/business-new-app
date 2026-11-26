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

type LookX = { id: string | number; photoUrl: string; views?: number; reach?: number; profileVisits?: number; bookings?: number; daily?: number[] };

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
  const reach = l?.reach ?? (l?.views != null ? Math.round(l.views * 0.64) : undefined);
  const days = l?.daily ?? (l?.views != null ? [0.1, 0.5, 1, 0.8, 0.65, 0.78, 0.5] : []);
  const mx = Math.max(1, ...days);
  const dn = tr('v3.weekdays').split(',');
  return (
    <Screen>
      <BackBar label={tr('v3.post')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/looks'))} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 8 }}>
          <Photo src={l?.photoUrl} style={{ width: 66, height: 90, borderRadius: 14 }} />
          <View style={{ flex: 1 }}><T k="h1">{tr('v3.stats')}</T><T k="sm" color={t.muted}>{demo ? tr('v3.sampleNums') : tr('v3.last30')}</T></View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20, marginTop: 8 }}>
          {([[tr('v3.sViews'), l?.views], [tr('v3.sReach'), reach], [tr('v3.sProfile'), l?.profileVisits ?? (l?.views != null ? 146 : undefined)], [tr('v3.sBookings'), l?.bookings ?? (l?.views != null ? 9 : undefined)]] as [string, number | undefined][]).map(([k, v]) => (
            <Card key={k} style={{ width: '47.5%', flexGrow: 1, padding: 14, gap: 2 }}><T k="sm" color={t.muted}>{k}</T><Text style={{ fontFamily: font.b, fontSize: 24, letterSpacing: -0.5, color: t.ink }}>{f(v)}</Text></Card>
          ))}
        </View>
        {days.length ? (
          <View style={{ paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22 }}><T k="h2">{tr('v3.last7')}</T><T k="sm" color={t.muted}>{tr('v3.viewsWord')}</T></View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110, marginTop: 14 }}>
              {days.map((v, i) => <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}><View style={{ width: '100%', height: Math.max(8, (v / mx) * 78), borderRadius: 8, backgroundColor: v === mx ? t.violet : t.lilac }} /><T k="xs" color={t.ink3}>{dn[i] ?? ''}</T></View>)}
            </View>
            <T k="h2" style={{ marginTop: 22, marginBottom: 6 }}>{tr('v3.whereSeen')}</T>
            <BarRow label={tr('v3.feed')} value="64%" ratio={0.64} />
            <BarRow label={tr('v3.salonPage')} value="28%" ratio={0.28} />
            <BarRow label="Story" value="8%" ratio={0.08} />
          </View>
        ) : null}
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
