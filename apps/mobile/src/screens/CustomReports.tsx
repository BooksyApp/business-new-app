import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, ScrollView, View } from 'react-native';
import { Choice, MultiChoice } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Header, Screen, Skeleton, StateView } from '@/components/ui';
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
          <Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted }}>{tr('cr.dataset')}</Text>
          <Choice value={ds} onChange={(v) => { setDs(v); setCols([]); setRes(null); }} options={(cat.data ?? []).map((d) => ({ value: d.key, label: d.label }))} />
          {cur ? (<><Text style={{ fontFamily: font.s, fontSize: 13, color: t.muted }}>{tr('cr.columns')}</Text><MultiChoice value={cols} onChange={setCols} options={cur.columns.map((c) => ({ value: c.key, label: c.label }))} /><Btn label={tr('cr.run')} loading={busy} onPress={() => void run()} /></>) : <StateView icon="spark" title={tr('cr.pick')} />}
          {res ? (res.rows.length === 0 ? <StateView icon="paper" title={tr('rp.empty')} /> : res.rows.slice(0, 100).map((r, i) => (
            <Card key={i} style={{ gap: 2, padding: 12 }}>
              {res.columns.map((c, j) => <View key={c.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{c.label}</Text><Text style={{ fontFamily: font.s, fontSize: 14, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{String(r[j] ?? '-')}</Text></View>)}
            </Card>
          ))) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
