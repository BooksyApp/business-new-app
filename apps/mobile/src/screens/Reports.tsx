import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Text } from '@/components/Text';
import { Card, Chip, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
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
  return (
    <Screen>
      <Header title={tr('rp.title')} subtitle={salon?.name} onBack={onBack} />
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
        {(['today', 'week', 'month'] as const).map((r) => <Chip key={r} label={tr(`rp.${r}` as 'rp.today')} active={range === r} onPress={() => setRange(r)} />)}
      </View>
      {d.error && !d.data ? <ErrorState error={d.error} onRetry={() => void d.reload()} /> : d.loading && !d.data ? <Skeleton rows={5} height={84} /> : !d.data ? <StateView icon="spark" title={tr('rp.empty')} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 12 }} refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={() => void d.reload()} tintColor={t.violet} />}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {KPIS.filter((k) => d.data!.kpis[k]).map((k) => {
              const p = d.data!.kpis[k]; const dl = delta(p.value, p.previous);
              return (
                <Card key={k} style={{ width: '48%', flexGrow: 1, padding: 12 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 12.5, color: t.muted }}>{tr(`rp.${k}` as 'rp.revenue')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginTop: 2 }}>{fmt(k, p.value)}</Text>
                  {dl != null ? <Text style={{ fontFamily: font.b, fontSize: 12, color: dl >= 0 ? t.ok : t.gink }}>{dl >= 0 ? '+' : ''}{dl}% {tr('rp.vsPrev')}</Text> : null}
                </Card>
              );
            })}
          </View>
          {d.data.topServices.length ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{tr('rp.top')}</Text>
              {d.data.topServices.slice(0, 6).map((s) => (
                <View key={s.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.m, fontSize: 14.5, color: t.ink }}>{s.name}</Text>
                  <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{s.bookings} · {money(s.revenue, salon?.currency)}</Text>
                </View>
              ))}
            </Card>
          ) : null}
          {d.data.staff.length ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{tr('rp.team')}</Text>
              {d.data.staff.map((s) => (
                <View key={s.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.m, fontSize: 14.5, color: t.ink }}>{s.name}</Text>
                  <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{s.visits} · {money(s.revenue, salon?.currency)}</Text>
                </View>
              ))}
            </Card>
          ) : null}
          {d.data.sources.length ? (
            <Card style={{ gap: 8 }}>
              <Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{tr('rp.sources')}</Text>
              {d.data.sources.map((s) => (
                <View key={s.source} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.ink, textTransform: 'capitalize' }}>{s.source}</Text>
                  <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.ink }}>{s.bookings}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
