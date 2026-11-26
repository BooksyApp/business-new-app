import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';
import { ErrorState, Screen } from '@/components/ui';
import { BackBar, BarRow, Card, Delta, EmptyState, ListItem, SecHead, Segmented, Skeleton, Spark, T, Title } from '@/components/kit';
import { t as tr } from '@/i18n';
import { apiX } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { addDays, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Range = 'today' | 'week' | 'month';
const KPIS = ['revenue', 'bookings', 'averageTicket', 'clients', 'newClients', 'returningClients', 'noShowRate', 'cancellationRate', 'utilization', 'onlineShare'] as const;
const PCT = new Set<string>(['noShowRate', 'cancellationRate', 'utilization', 'onlineShare']);
const MONEY = new Set<string>(['revenue', 'averageTicket']);

/** Hesabatlar: KPI tiles with change against the previous period, top services, team and booking sources. */
export function Reports({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, version } = useApp();
  const [range, setRange] = useState<Range>('week');
  const to = new Date();
  const from = range === 'today' ? to : addDays(to, range === 'week' ? -6 : -29);
  const d = useLoad(() => apiX.dashboard(salon?.id ?? '', from, to), [salon?.id, range, version]);
  const fmt = (k: string, v: number) => (MONEY.has(k) ? money(v, salon?.currency) : PCT.has(k) ? `${Math.round(v * (v <= 1 ? 100 : 1))}%` : String(Math.round(v)));
  const delta = (v: number, p: number) => (p ? Math.round(((v - p) / Math.abs(p)) * 100) : null);
  const [w, setW] = useState(0);
  const main = d.data?.kpis.revenue; const mdl = main ? delta(main.value, main.previous) : null;
  const rest = KPIS.filter((k) => k !== 'revenue' && d.data?.kpis[k]);
  const topMax = Math.max(1, ...(d.data?.topServices ?? []).map((x) => x.revenue));
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} />
      <Title sub={salon?.name} style={{ paddingBottom: 12 }}>{tr('rp.title')}</Title>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Segmented items={(['today', 'week', 'month'] as const).map((r) => ({ k: r, label: tr(`rp.${r}` as 'rp.today') }))} value={range} onChange={setRange} />
      </View>
      {d.error && !d.data ? <ErrorState error={d.error} onRetry={() => void d.reload()} /> : d.loading && !d.data ? <Skeleton blocks={[{ h: 70 }, { h: 120 }, { h: 220 }]} /> : !d.data ? <EmptyState photo={'demo:f05'} title={tr('rp.empty')} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={() => void d.reload()} tintColor={t.violet} />}>
          {main ? (
            <View style={{ paddingHorizontal: 20 }}>
              <T k="sm" color={t.muted}>{tr('rp.revenue')}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                <Text style={{ fontFamily: font.x, fontSize: 40, lineHeight: 46, letterSpacing: -1.4, color: t.ink }}>{fmt('revenue', main.value)}</Text>
                {mdl != null ? <Delta v={mdl} /> : null}
              </View>
              {d.data.series && d.data.series.length > 1 ? <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 14 }}><Spark data={d.data.series} width={w} height={96} /></View> : null}
            </View>
          ) : null}
          {rest.length ? (
            <Card style={{ marginHorizontal: 20, marginTop: 18, paddingHorizontal: 18, paddingVertical: 4 }}>
              {rest.map((k, i) => {
                const p = d.data!.kpis[k]; const dl = delta(p.value, p.previous);
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
                    <T k="t1" style={{ fontFamily: font.m }}>{tr(`rp.${k}` as 'rp.revenue')}</T>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{fmt(k, p.value)}</Text>
                      {dl != null ? <Delta v={dl} /> : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}
          {d.data.topServices.length ? (
            <View style={{ marginHorizontal: 20 }}>
              <SecHead title={tr('rp.top')} style={{ marginHorizontal: 0 }} />
              {d.data.topServices.slice(0, 6).map((s) => <BarRow key={s.name} label={s.name} value={money(s.revenue, salon?.currency)} ratio={s.revenue / topMax} />)}
            </View>
          ) : null}
          {d.data.staff.length ? (
            <View style={{ marginHorizontal: 20 }}>
              <SecHead title={tr('rp.team')} style={{ marginHorizontal: 0 }} />
              {d.data.staff.map((s, i) => <ListItem key={s.name} first={i === 0} title={s.name} sub={`${s.visits} ${tr('v3.visitsN')}`} right={<Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{money(s.revenue, salon?.currency)}</Text>} />)}
            </View>
          ) : null}
          {d.data.sources.length ? (
            <View style={{ marginHorizontal: 20 }}>
              <SecHead title={tr('rp.sources')} style={{ marginHorizontal: 0 }} />
              {d.data.sources.map((s, i) => <ListItem key={s.source} first={i === 0} title={s.source} right={<Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{s.bookings}</Text>} />)}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
