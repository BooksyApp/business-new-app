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
  // the API sends percent KPIs already as 0-100 (round1), never as a 0-1 ratio
  const fmt = (k: string, v: number) => (MONEY.has(k) ? money(v, salon?.currency) : PCT.has(k) ? `${Math.round(Math.max(0, Math.min(100, v)))}%` : String(Math.round(v)));
  const delta = (v: number, p: number) => { const r = p ? Math.round(((v - p) / Math.abs(p)) * 100) : null; return r != null && Number.isFinite(r) ? r : null; };
  const [w, setW] = useState(0);
  const main = d.data?.kpis.revenue; const mdl = main ? delta(main.value, main.previous) : null;
  const rest = KPIS.filter((k) => k !== 'revenue' && d.data?.kpis[k]);
  const topMax = Math.max(1, ...(d.data?.topServices ?? []).map((x) => x.revenue));
  const srcRows = (d.data?.sources ?? []).filter((x) => x.bookings > 0);
  const srcMax = Math.max(1, ...srcRows.map((x) => x.bookings));
  const srcLabel = (k: string) => (['marketplace', 'widget', 'link', 'hub', 'other'].includes(k) ? tr(`rp.src_${k}` as 'rp.src_hub') : k);
  const series = d.data?.series && Math.max(...d.data.series) > 0 ? d.data.series : null;
  const isEmpty = !!d.data && Object.values(d.data.kpis).every((x) => !x.value) && !d.data.topServices.length && !d.data.staff.some((x) => x.visits || x.revenue) && !srcRows.length;
  return (
    <Screen>
      <BackBar label={tr('v2.tabMore')} onBack={onBack} />
      <Title sub={salon?.name} style={{ paddingBottom: 12 }}>{tr('rp.title')}</Title>
      <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
        <Segmented items={(['today', 'week', 'month'] as const).map((r) => ({ k: r, label: tr(`rp.${r}` as 'rp.today') }))} value={range} onChange={setRange} />
      </View>
      {d.error && !d.data ? <ErrorState error={d.error} onRetry={() => void d.reload()} /> : d.loading && !d.data ? <Skeleton blocks={[{ h: 70 }, { h: 120 }, { h: 220 }]} /> : !d.data || isEmpty ? <EmptyState photo={'demo:f05'} title={tr('rp.empty')} body={tr('rp.emptyHint')} /> : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={() => void d.reload()} tintColor={t.violet} />}>
          {main ? (
            <View style={{ paddingHorizontal: 20 }}>
              <T k="sm" color={t.muted}>{tr('rp.revenue')}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ flexShrink: 1, fontFamily: font.x, fontSize: 40, lineHeight: 46, letterSpacing: -1.4, color: t.ink }}>{fmt('revenue', main.value)}</Text>
                {mdl != null ? <Delta v={mdl} /> : null}
              </View>
              {series ? <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 14 }}><Spark data={series} width={w} height={96} /></View> : null}
            </View>
          ) : null}
          {rest.length ? (
            <Card style={{ marginHorizontal: 20, marginTop: 18, paddingHorizontal: 18, paddingVertical: 4 }}>
              {rest.map((k, i) => {
                const p = d.data!.kpis[k]; const dl = delta(p.value, p.previous);
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.hair }}>
                    <T k="t1" style={{ fontFamily: font.m, flex: 1, marginRight: 10 }}>{tr(`rp.${k}` as 'rp.revenue')}</T>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
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
              {d.data.topServices.slice(0, 6).map((s, i) => <BarRow key={`${s.name}-${i}`} label={s.name} value={money(s.revenue, salon?.currency)} ratio={s.revenue / topMax} />)}
            </View>
          ) : null}
          {d.data.staff.length ? (
            <View style={{ marginHorizontal: 20 }}>
              <SecHead title={tr('rp.team')} style={{ marginHorizontal: 0 }} />
              {d.data.staff.map((s, i) => <ListItem key={`${s.name}-${i}`} first={i === 0} title={s.name} sub={`${s.visits} ${tr('v3.visitsN')}`} right={<Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{money(s.revenue, salon?.currency)}</Text>} />)}
            </View>
          ) : null}
          {srcRows.length ? (
            <View style={{ marginHorizontal: 20 }}>
              <SecHead title={tr('rp.sources')} style={{ marginHorizontal: 0 }} />
              {srcRows.map((s) => <BarRow key={s.source} label={srcLabel(s.source)} value={String(s.bookings)} ratio={s.bookings / srcMax} />)}
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
