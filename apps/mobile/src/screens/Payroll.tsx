import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { BackHandler, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, num } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Avatar, Button, ListItem, Pill, SecHead, Segmented, T } from '@/components/kit';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { ErrorState, Field, Header, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { addDays, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const CATS = ['DEFAULT', 'SERVICES', 'PRODUCTS', 'GIFT_CARDS', 'MEMBERSHIPS', 'PACKAGES'] as const;
const NUM = { fontVariant: ['tabular-nums' as const] };
type PayView = 'main' | 'rules' | 'runs' | 'time';

/** Flat label / value row: label one line on the left, money right-aligned with tabular numbers. */
function Row({ label, value, bold, first }: { label: string; value: string; bold?: boolean; first?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderTopWidth: first ? 0 : 1, borderTopColor: t.hair }}>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: bold ? font.s : font.m, fontSize: 15, color: bold ? t.ink : t.muted }}>{label}</Text>
      <Text numberOfLines={1} style={[NUM, { fontFamily: bold ? font.x : font.b, fontSize: bold ? 17 : 15, color: t.ink, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

/**
 * Komissiya və maaş. Main: month picker, one summary (to pay + commission), one compact row per specialist (opens one sheet with the
 * breakdown and the monthly target). Below: three rows that open one flat view each: commission rules, payroll runs, timesheet.
 */
export function Payroll({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? ''; const cur = salon?.currency;
  const [view, setView] = useState<PayView>('main');
  const [mo, setMo] = useState(0);
  const month = toDay(new Date(new Date().getFullYear(), new Date().getMonth() - mo, 1)).slice(0, 7);
  const rules = useLoad(() => apiB.commissionRules(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const targets = useLoad(() => apiB.targets(sid, month).catch(() => []), [sid, month]);
  const clocks = useLoad(() => (view === 'time' ? apiB.clockedIn(sid).catch(() => []) : Promise.resolve([])), [sid, view]);
  const sheet = useLoad(() => (view === 'time' ? apiB.timesheets(sid, toDay(addDays(new Date(), -13)), toDay(new Date())).catch(() => null) : Promise.resolve(null)), [sid, view]);
  const runs = useLoad(() => apiB.payrollRuns(sid).catch(() => []), [sid]);
  const [rc, setRc] = useState<(typeof CATS)[number]>('DEFAULT'); const [rt, setRt] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE'); const [rv, setRv] = useState(''); const [rs, setRs] = useState('');
  const [sp, setSp] = useState<string | null>(null); const [rev, setRev] = useState(''); const [bk, setBk] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const detail = useLoad(() => (open != null ? apiB.payrollRun(sid, open) : Promise.resolve(null)), [sid, open]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const monthRun = (runs.data ?? []).filter((r) => String(r.period_end).slice(0, 7) === month).sort((a, b) => (String(a.period_end) < String(b.period_end) ? 1 : -1))[0];
  const monthId = monthRun?.id;
  const monthDetail = useLoad(() => (monthId != null ? apiB.payrollRun(sid, monthId) : Promise.resolve(null)), [sid, monthId]);

  useEffect(() => {
    if (view === 'main') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setView('main'); return true; });
    return () => sub.remove();
  }, [view]);

  const run = async (fn: () => Promise<unknown>, after?: () => void, sink?: (m: string) => void) => {
    setBusy(true); sink?.('');
    try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after?.(); } catch (e) { const m = (e as Error).message; if (sink) sink(m); else toast(m, 'error'); } finally { setBusy(false); }
  };
  const staffName = (id?: string | number) => (staff.data ?? []).find((s) => String(s.id) === String(id))?.name ?? tr('pr.everyone');
  const people = (staff.data ?? []).filter((s) => s.isActive !== false);
  const tgt = (id: string | number) => (targets.data ?? []).find((x) => String(x.staffId) === String(id));
  const lines = monthDetail.data?.lines ?? [];
  const lineOf = (name: string) => lines.find((l) => l.staff_name === name);
  const toPay = monthDetail.data ? monthDetail.data.total_amount : monthRun?.total_amount ?? 0;
  const commTotal = lines.reduce((a, l) => a + Number(l.commission || 0), 0);
  const ruleText = (id: string | number) => {
    const act = (rules.data ?? []).filter((r) => r.isActive !== false && (r.category === 'DEFAULT' || r.category === 'SERVICES'));
    const r = act.find((x) => x.staffId != null && String(x.staffId) === String(id)) ?? act.find((x) => x.staffId == null || String(x.staffId) === '');
    return r ? (r.type === 'PERCENTAGE' ? `${r.value}%` : money(r.value, cur)) : null;
  };
  const openStaff = (id: string | number) => { const g = tgt(id); setRev(String(g?.revenueTarget || '')); setBk(String(g?.bookingsTarget || '')); setErr(''); setSp(String(id)); };
  const selP = sp != null ? people.find((s) => String(s.id) === sp) : undefined;
  const selT = selP ? tgt(selP.id) : undefined;
  const selL = selP ? lineOf(selP.name) : undefined;
  const reloadMonth = () => { void runs.reload(); void monthDetail.reload(); };

  const q = view === 'main' ? staff : view === 'rules' ? rules : view === 'time' ? clocks : runs;
  const title = view === 'rules' ? tr('pr.rulesRow') : view === 'runs' ? tr('pr.runsRow') : view === 'time' ? tr('pr.time') : tr('pr.title');
  const chev = <Icon name="chev" size={16} color={t.ink3} />;
  const monthLabel = (i: number) => toDay(new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)).slice(0, 7);

  return (
    <Screen>
      <Header title={title} subtitle={view === 'main' ? salon?.name : undefined} onBack={view === 'main' ? onBack : () => setView('main')} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={4} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 4 }}>
          {view === 'main' ? (
            <>
              <Segmented items={[{ k: '0', label: tr('pr.thisMonth') }, { k: '1', label: tr('pr.lastMonth') }, { k: '2', label: monthLabel(2) }]} value={String(mo)} onChange={(k) => setMo(Number(k))} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 6 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T k="t2" color={t.muted} lines={1}>{tr('pr.toPay')}</T>
                  <Text numberOfLines={1} style={[NUM, { fontFamily: font.x, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: t.ink }]}>{monthRun ? money(toPay, cur) : '—'}</Text>
                  <T k="t2" color={t.muted} lines={1} style={NUM}>{monthRun ? `${tr('pr.commission')} ${money(commTotal, cur)}` : tr('pr.noRunMonth')}</T>
                </View>
                {monthRun && monthRun.status === 'DRAFT' ? <Button size="sm" label={tr('pr.approve')} loading={busy} onPress={() => void run(() => apiB.approvePayroll(sid, monthRun.id), reloadMonth)} /> : null}
                {monthRun && monthRun.status === 'APPROVED' ? <Button size="sm" label={tr('pr.markPaid')} loading={busy} onPress={() => void run(() => apiB.payPayroll(sid, monthRun.id, toDay(new Date()), 'CASH'), reloadMonth)} /> : null}
                {monthRun && monthRun.status === 'PAID' ? <Pill text={tr('pr.paid')} tone="ok" /> : null}
              </View>
              <SecHead title={tr('pr.specialists')} style={{ marginHorizontal: 0, marginTop: 16, marginBottom: 4 }} />
              {people.length === 0 ? <StateView icon="spark" title={tr('pr.noTargets')} /> : null}
              {people.map((s, i) => {
                const g = tgt(s.id); const l = lineOf(s.name); const rt0 = ruleText(s.id);
                const meta = [g ? tr('pr.svcN', { n: g.bookingsActual }) : null, rt0 ? `${rt0} ${tr('pr.commissionLc')}` : null].filter(Boolean).join(' · ');
                return (
                  <Pressable key={String(s.id)} onPress={() => openStaff(s.id)} noScale accessibilityRole="button" accessibilityLabel={s.name}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.hair }}>
                    <Avatar name={s.name} size={36} uri={s.avatarUrl} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T k="t1" lines={1}>{s.name}</T>
                      {meta ? <T k="t2" color={t.muted} lines={1}>{meta}</T> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text numberOfLines={1} style={[NUM, { fontFamily: font.b, fontSize: 15, color: t.ink, textAlign: 'right' }]}>{l ? money(l.total, cur) : '—'}</Text>
                      {l && monthRun ? <Pill text={monthRun.status === 'PAID' ? tr('pr.paid') : tr('pr.unpaid')} tone={monthRun.status === 'PAID' ? 'ok' : 'fl'} /> : null}
                    </View>
                    {chev}
                  </Pressable>
                );
              })}
              <View style={{ marginTop: 18 }}>
                <ListItem first title={tr('pr.rulesRow')} onPress={() => setView('rules')} right={chev} />
                <ListItem title={tr('pr.runsRow')} onPress={() => setView('runs')} right={chev} />
                <ListItem title={tr('pr.time')} onPress={() => setView('time')} right={chev} />
              </View>
            </>
          ) : null}
          {view === 'rules' ? (
            <>
              {(rules.data ?? []).map((r, i) => (
                <ListItem key={String(r.id)} first={i === 0} title={r.type === 'PERCENTAGE' ? `${r.value}%` : money(r.value, cur)} sub={`${tr(`pr.c.${r.category}` as 'pr.c.DEFAULT')} · ${staffName(r.staffId)}`}
                  right={<Pressable onPress={() => r.id != null && void run(() => apiB.deleteCommissionRule(r.id!), () => void rules.reload())} accessibilityRole="button"><Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14, color: t.gink }}>{tr('lk.delete')}</Text></Pressable>} />
              ))}
              {(rules.data ?? []).length === 0 ? <StateView icon="cash" title={tr('pr.noRules')} /> : null}
              <SecHead title={tr('pr.newRule')} style={{ marginHorizontal: 0, marginTop: 20, marginBottom: 10 }} />
              <Choice value={rc} onChange={setRc} options={CATS.map((c) => ({ value: c, label: tr(`pr.c.${c}` as 'pr.c.DEFAULT') }))} />
              <Choice value={rt} onChange={setRt} options={[{ value: 'PERCENTAGE' as const, label: '%' }, { value: 'FIXED_AMOUNT' as const, label: tr('mk.fixed') }]} />
              <Choice value={rs} onChange={setRs} options={[{ value: '', label: tr('pr.everyone') }, ...(staff.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} />
              <Field label={tr('mk.value')} value={rv} onChangeText={setRv} keyboardType="decimal-pad" />
              <Button block label={tr('pr.addRule')} loading={busy} disabled={!(num(rv) > 0)} onPress={() => void run(() => apiB.createCommissionRule({ businessId: sid, category: rc, type: rt, value: num(rv), staffId: rs || undefined, isActive: true }), () => { setRv(''); void rules.reload(); })} />
            </>
          ) : null}
          {view === 'runs' ? (
            <>
              {(runs.data ?? []).map((r, i) => (
                <ListItem key={String(r.id)} first={i === 0} title={`${r.period_start} - ${r.period_end}`} sub={money(r.total_amount, cur)} onPress={() => { setErr(''); setOpen(String(r.id)); }}
                  right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pill text={tr(`pr.s.${r.status}` as 'pr.s.DRAFT')} tone={r.status === 'PAID' ? 'ok' : r.status === 'APPROVED' ? 'v' : 'fl'} />{chev}</View>} />
              ))}
              {(runs.data ?? []).length === 0 ? <StateView icon="wallet" title={tr('pr.noRuns')} /> : null}
              <View style={{ marginTop: 16, gap: 10 }}>
                <Button block label={tr('pr.build')} loading={busy} onPress={() => { const to = new Date(); const from = addDays(to, -13); void run(() => apiB.buildPayroll(sid, toDay(from), toDay(to)), reloadMonth); }} />
                <T k="sm" color={t.muted}>{tr('pr.buildHint')}</T>
              </View>
            </>
          ) : null}
          {view === 'time' ? (
            <>
              {people.map((s, i) => {
                const on = (clocks.data ?? []).some((c) => String(c.staff_id) === String(s.id));
                return (
                  <View key={String(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.hair }}>
                    <Avatar name={s.name} size={36} uri={s.avatarUrl} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T k="t1" lines={1}>{s.name}</T>
                      {on ? <T k="t2" color={t.ok} lines={1}>{tr('pr.clockedIn')}</T> : null}
                    </View>
                    <Button size="sm" kind={on ? 'danger' : 'fl'} label={on ? tr('pr.clockOut') : tr('pr.clockIn')} loading={busy} onPress={() => void run(() => (on ? apiB.clockOut(sid, s.id) : apiB.clockIn(sid, s.id)), () => { void clocks.reload(); void sheet.reload(); })} />
                  </View>
                );
              })}
              {(sheet.data?.byStaff ?? []).length ? <SecHead title={tr('pr.hours14')} style={{ marginHorizontal: 0, marginTop: 20, marginBottom: 4 }} /> : null}
              {(sheet.data?.byStaff ?? []).map((r, i) => <Row key={String(r.staff_id)} first={i === 0} label={r.staff_name ?? '-'} value={`${Number(r.hours).toFixed(1)} h · ${money(Number(r.pay), cur)}`} />)}
            </>
          ) : null}
        </ScrollView>
      )}
      <BottomSheet open={sp != null} onClose={() => setSp(null)}>
        {selP ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Avatar name={selP.name} size={36} uri={selP.avatarUrl} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T k="h2" lines={1}>{selP.name}</T>
                <T k="t2" color={t.muted} lines={1}>{month}</T>
              </View>
            </View>
            <Row first label={tr('pr.revenue')} value={money(selT?.revenueActual ?? 0, cur)} />
            <Row label={tr('pr.services')} value={String(selT?.bookingsActual ?? 0)} />
            {selL ? (
              <>
                <Row label={tr('pr.commission')} value={money(selL.commission, cur)} />
                <Row label={tr('pr.salary')} value={money(selL.base_pay, cur)} />
                <Row label={tr('pr.hours')} value={`${Number(selL.hours).toFixed(1)} h`} />
                <Row label={tr('pr.tips')} value={money(selL.tips, cur)} />
                <Row bold label={tr('sl.total')} value={money(selL.total, cur)} />
              </>
            ) : <T k="t2" color={t.muted} style={{ marginVertical: 8 }}>{tr('pr.noRunMonth')}</T>}
            <SecHead title={tr('pr.monthTarget')} style={{ marginHorizontal: 0, marginTop: 18, marginBottom: 10 }} />
            <Field label={`${tr('pr.revTarget')} (${cur ?? 'AZN'})`} value={rev} onChangeText={setRev} keyboardType="decimal-pad" />
            <Field label={tr('pr.bkTarget')} value={bk} onChangeText={setBk} keyboardType="number-pad" />
            {err ? <T k="t2" color={t.gink} style={{ marginBottom: 8 }}>{err}</T> : null}
            <Button block label={tr('common.save')} loading={busy} onPress={() => sp != null && void run(() => apiB.setTarget(sid, sp, month, { revenueTarget: num(rev) || 0, bookingsTarget: Math.round(num(bk)) || 0 }), () => { setSp(null); void targets.reload(); }, setErr)} />
            <View style={{ height: 16 }} />
          </>
        ) : null}
      </BottomSheet>
      <BottomSheet open={open != null} onClose={() => setOpen(null)}>
        {detail.data ? (
          <>
            <T k="h2" lines={1} style={{ marginBottom: 6 }}>{detail.data.period_start} - {detail.data.period_end}</T>
            {(detail.data.lines ?? []).map((l, i) => <Row key={String(l.id)} first={i === 0} label={l.staff_name ?? '-'} value={money(l.total, cur)} />)}
            <Row bold label={tr('sl.total')} value={money(detail.data.total_amount, cur)} />
            {err ? <T k="t2" color={t.gink} style={{ marginTop: 8 }}>{err}</T> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, paddingBottom: 16 }}>
              {detail.data.status === 'DRAFT' ? <Button block label={tr('pr.approve')} style={{ flex: 1 }} loading={busy} onPress={() => void run(() => apiB.approvePayroll(sid, detail.data!.id), () => { void detail.reload(); reloadMonth(); }, setErr)} /> : null}
              {detail.data.status === 'APPROVED' ? <Button block label={tr('pr.markPaid')} style={{ flex: 1 }} loading={busy} onPress={() => void run(() => apiB.payPayroll(sid, detail.data!.id, toDay(new Date()), 'CASH'), () => { void detail.reload(); reloadMonth(); }, setErr)} /> : null}
            </View>
          </>
        ) : <Skeleton rows={3} />}
      </BottomSheet>
    </Screen>
  );
}
