import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Line, TabBar, num } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Hero, Pill, Screen, Skeleton, Spark, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { toDay } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, fromIso, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Tab = 'profit' | 'tax' | 'tips' | 'invoices' | 'drawer' | 'gift';
const N = (v: number | string | null | undefined) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Maliyyə: profit and loss by month, tax summary, tips (and pay-out), invoices (void), cash drawer, gift cards (sell, look up). */
export function Finance({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? ''; const cur = salon?.currency;
  const [tab, setTab] = useState<Tab>('profit');
  const from = toDay(addDays(new Date(), -29)); const to = toDay(new Date());
  const profit = useLoad(() => (tab === 'profit' ? apiB.profit(sid, 6) : Promise.resolve(null)), [sid, tab]);
  const tax = useLoad(() => (tab === 'tax' ? apiB.tax(sid, from, to) : Promise.resolve(null)), [sid, tab]);
  const tips = useLoad(() => (tab === 'tips' ? apiB.tips(sid, from, to) : Promise.resolve(null)), [sid, tab]);
  const inv = useLoad(() => (tab === 'invoices' ? apiB.invoices(sid, from, to) : Promise.resolve(null)), [sid, tab]);
  const dr = useLoad(() => (tab === 'drawer' ? apiB.drawer(sid) : Promise.resolve(undefined)), [sid, tab]);
  const [float, setFloat] = useState(''); const [counted, setCounted] = useState('');
  const [gAmt, setGAmt] = useState(''); const [gMail, setGMail] = useState(''); const [gCode, setGCode] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after?.(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } };
  const q = { profit, tax, tips, invoices: inv, drawer: dr, gift: null }[tab];
  const m = (v: number | string | null | undefined) => money(N(v), cur);
  const sec = (s: string) => <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 17, color: t.ink, marginTop: 6 }}>{s}</Text>;
  return (
    <Screen>
      <Header title={tr('fn.title')} subtitle={salon?.name} onBack={onBack} />
      <TabBar value={tab} onChange={setTab} tabs={[{ k: 'profit', label: tr('fn.profit') }, { k: 'tax', label: tr('fn.tax') }, { k: 'tips', label: tr('fn.tips') }, { k: 'invoices', label: tr('fn.invoices') }, { k: 'drawer', label: tr('fn.drawer') }, { k: 'gift', label: tr('fn.gift') }]} />
      {q && q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q && q.loading && q.data == null ? <Skeleton rows={4} height={72} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 12 }} refreshControl={q ? <RefreshControl refreshing={q.refreshing} onRefresh={() => void q.reload()} tintColor={t.violet} /> : undefined}>
          {tab === 'profit' && profit.data ? (
            <>
              <Hero><View style={{ padding: 20, gap: 4 }}>
                <Text style={{ fontFamily: font.s, fontSize: 15, color: t.muted }}>{tr('fn.profit')}</Text>
                <Text style={{ fontFamily: font.x, fontSize: 40, letterSpacing: -1.3, color: t.ink }}>{m(profit.data.totals?.profit)}</Text>
                {(profit.data.months ?? []).length > 1 ? <View style={{ marginTop: 6, marginHorizontal: -4 }}><Spark data={[...(profit.data.months ?? [])].reverse().map((x) => N(x.profit))} width={300} height={56} /></View> : null}
                <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
                  {([[tr('rp.revenue'), profit.data.totals?.revenue], [tr('ex.title'), profit.data.totals?.expenses], [tr('fn.wages'), profit.data.totals?.wages]] as const).map(([k, v]) => (
                    <View key={k} style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{k}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{m(v)}</Text></View>
                  ))}
                </View>
              </View></Hero>
              {(profit.data.months ?? []).map((x) => <Card key={x.month}><Text style={{ fontFamily: font.x, fontSize: 15, color: t.ink }}>{x.month}</Text><Line label={tr('rp.revenue')} value={m(x.revenue)} /><Line label={tr('fn.profitLine')} value={m(x.profit)} bold /></Card>)}
            </>
          ) : null}
          {tab === 'tax' && tax.data ? (
            <>
              <Card><Line label={tr('fn.net')} value={m(tax.data.totals.net)} /><Line label={tr('fn.taxLine')} value={m(tax.data.totals.tax)} /><Line bold label={tr('fn.gross')} value={m(tax.data.totals.gross)} /></Card>
              {tax.data.byRate.map((r) => <Card key={String(r.rate)}><Line label={`${N(r.rate)}%`} value={`${m(r.net)} + ${m(r.tax)}`} /></Card>)}
            </>
          ) : null}
          {tab === 'tips' && tips.data ? (
            <>
              <Card><Line label={tr('sl.total')} value={m(tips.data.totals.total)} /><Line label={tr('fn.outstanding')} value={m(tips.data.totals.outstanding)} bold /></Card>
              {tips.data.byStaff.map((s, i) => <Card key={i}><Line label={s.staff_name ?? '-'} value={`${m(s.earned)} (${m(s.outstanding)})`} /></Card>)}
              {tips.data.totals.outstanding > 0 ? <Btn label={tr('fn.payOut')} loading={busy} onPress={() => Alert.alert(tr('fn.payOutConfirm'), m(tips.data!.totals.outstanding), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('fn.payOut'), onPress: () => void run(() => apiB.payOutTips(sid), () => void tips.reload()) }])} /> : null}
            </>
          ) : null}
          {tab === 'invoices' ? (
            <>
              {(inv.data ?? []).map((x) => (
                <Card key={String(x.id)} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{x.number}</Text><Pill text={x.status} tone={x.status === 'VOID' ? 'muted' : 'ok'} /></View>
                  <Line label={`${dateLabel(fromIso(x.issued_on))} · ${x.buyer_name ?? '-'}`} value={m(x.gross_amount)} />
                  {x.status === 'ISSUED' ? <Btn label={tr('fn.void')} variant="danger" onPress={() => Alert.alert(tr('fn.voidConfirm'), x.number, [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('fn.void'), style: 'destructive', onPress: () => void run(() => apiB.voidInvoice(sid, x.id, 'mobile'), () => void inv.reload()) }])} /> : null}
                </Card>
              ))}
              {(inv.data ?? []).length === 0 ? <StateView icon="receipt" title={tr('fn.noInvoices')} body={tr('fn.noInvoicesBody')} /> : null}
            </>
          ) : null}
          {tab === 'drawer' ? (
            dr.data ? (
              <>
                <Card><Line label={tr('fn.openingFloat')} value={m(dr.data.opening_float)} /><Line bold label={tr('fn.expected')} value={m(dr.data.expected)} /></Card>
                <Field label={tr('fn.counted')} value={counted} onChangeText={setCounted} keyboardType="decimal-pad" />
                <Btn label={tr('fn.closeDrawer')} loading={busy} disabled={!(num(counted) >= 0)} onPress={() => void run(() => apiB.closeDrawer(sid, dr.data!.id, num(counted)), () => { setCounted(''); void dr.reload(); })} />
              </>
            ) : (
              <>
                <StateView icon="cash" title={tr('fn.drawerClosed')} />
                <Field label={tr('fn.openingFloat')} value={float} onChangeText={setFloat} keyboardType="decimal-pad" />
                <Btn label={tr('fn.openDrawer')} loading={busy} disabled={!(num(float) >= 0)} onPress={() => void run(() => apiB.openDrawer(sid, num(float)), () => { setFloat(''); void dr.reload(); })} />
              </>
            )
          ) : null}
          {tab === 'gift' ? (
            <>
              {sec(tr('fn.sellGift'))}
              <Field label={`${tr('ex.amount')} (${cur ?? 'AZN'})`} value={gAmt} onChangeText={setGAmt} keyboardType="decimal-pad" />
              <Field label={tr('cl.email')} value={gMail} onChangeText={setGMail} keyboardType="email-address" autoCapitalize="none" />
              <Btn label={tr('fn.issue')} loading={busy} disabled={!(num(gAmt) > 0)} onPress={() => void run(async () => { const c = await apiB.issueGiftCard(sid, num(gAmt), gMail.trim()); Alert.alert(tr('fn.giftCode'), `${c.code}\n${m(c.amount)}`); setGAmt(''); setGMail(''); })} />
              {sec(tr('fn.lookup'))}
              <Field label={tr('sl.giftCode')} value={gCode} onChangeText={setGCode} autoCapitalize="characters" autoCorrect={false} />
              <Btn label={tr('fn.check')} variant="secondary" loading={busy} disabled={!gCode.trim()} onPress={() => void run(async () => { const c = await apiB.lookupGiftCard(gCode.trim()); Alert.alert(c.code, `${tr('fn.balance')}: ${m(c.balance)} / ${m(c.amount)}`); })} />
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
