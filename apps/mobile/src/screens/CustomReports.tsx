import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, ScrollView, View } from 'react-native';
import { Choice, MultiChoice } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Card, Chip, ErrorState, Header, HeroCard, Screen, Section, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { toDay } from '@/lib/api';
import { apiB, type ReportResult } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { addDays } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Xüsusi hesabatlar: pick a dataset and columns, run for the last 30 days, read the result as cards. */
export function CustomReports({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const cat = useLoad(() => apiB.catalog(sid), [sid]);
  const [ds, setDs] = useState('');
  const [cols, setCols] = useState<string[]>([]);
  const [res, setRes] = useState<ReportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = (cat.data ?? []).find((d) => d.key === ds);
  async function run() {
    if (!cur) return;
    setBusy(true);
    try { setRes(await apiB.runReport(sid, { dataset: cur.key, columns: cols.length ? cols : cur.columns.slice(0, 4).map((c) => c.key), groupBy: cur.defaultGroupBy, from: toDay(addDays(new Date(), -29)), to: toDay(new Date()) })); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('cr.title')} subtitle={salon?.name} onBack={onBack} />
      {cat.error && !cat.data ? <ErrorState error={cat.error} onRetry={() => void cat.reload()} /> : cat.loading && !cat.data ? <Skeleton rows={3} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60, gap: 10 }}>
          <HeroCard dark icon="paper" title={tr('cr.title')} sub={tr('cr.dataset')} />
          <Section title={tr('cr.dataset')}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>{(cat.data ?? []).map((d) => <Chip key={d.key} label={d.label} active={ds === d.key} onPress={() => { setDs(d.key); setCols([]); setRes(null); }} />)}</ScrollView>
          </Section>
          {cur ? (<Section title={tr('cr.columns')}><MultiChoice value={cols} onChange={setCols} options={cur.columns.map((c) => ({ value: c.key, label: c.label }))} /><Btn label={tr('cr.run')} loading={busy} onPress={() => void run()} /></Section>) : <StateView icon="spark" title={tr('cr.pick')} />}
          {res ? (res.rows.length === 0 ? <StateView icon="paper" title={tr('rp.empty')} /> : res.rows.slice(0, 100).map((r, i) => (
            <Card key={i} style={{ gap: 4, padding: 18 }}>
              <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 22, letterSpacing: -0.5, color: t.ink, marginBottom: 4 }}>{String(r[0] ?? '-')}</Text>
              {res.columns.slice(1).map((c, j0) => { const j = j0 + 1; return <View key={c.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{c.label}</Text><Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{String(r[j] ?? '-')}</Text></View>; })}
            </Card>
          ))) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
