import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, Line, TabBar, num } from '@/components/form';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Pill, Screen, Skeleton, StateView } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { addDays, money } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const CATS = ['DEFAULT', 'SERVICES', 'PRODUCTS', 'GIFT_CARDS', 'MEMBERSHIPS', 'PACKAGES'] as const;

/** Komissiya, hədəflər və əmək haqqı: commission rules, monthly targets per specialist, payroll runs (build, approve, mark paid). */
export function Payroll({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? ''; const cur = salon?.currency;
  const [tab, setTab] = useState<'rules' | 'targets' | 'runs'>('rules');
  const month = toDay(new Date()).slice(0, 7);
  const rules = useLoad(() => apiB.commissionRules(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const targets = useLoad(() => apiB.targets(sid, month).catch(() => []), [sid, month]);
  const runs = useLoad(() => apiB.payrollRuns(sid).catch(() => []), [sid]);
  const [rc, setRc] = useState<(typeof CATS)[number]>('DEFAULT'); const [rt, setRt] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE'); const [rv, setRv] = useState(''); const [rs, setRs] = useState('');
  const [tg, setTg] = useState<{ id: string; name: string } | null>(null); const [rev, setRev] = useState(''); const [bk, setBk] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const detail = useLoad(() => (open != null ? apiB.payrollRun(sid, open) : Promise.resolve(null)), [sid, open]);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after?.(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); } };
  const q = tab === 'rules' ? rules : tab === 'targets' ? targets : runs;
  const staffName = (id?: string | number) => (staff.data ?? []).find((s) => String(s.id) === String(id))?.name ?? tr('pr.everyone');
  return (
    <Screen>
      <Header title={tr('pr.title')} subtitle={salon?.name} onBack={onBack} />
      <TabBar value={tab} onChange={setTab} tabs={[{ k: 'rules', label: tr('pr.rules') }, { k: 'targets', label: tr('pr.targets') }, { k: 'runs', label: tr('pr.runs') }]} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={4} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48, gap: 10 }}>
          {tab === 'rules' ? (
            <>
              {(rules.data ?? []).map((r) => (
                <Card key={String(r.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{r.type === 'PERCENTAGE' ? `${r.value}%` : money(r.value, cur)}</Text><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{tr(`pr.c.${r.category}` as 'pr.c.DEFAULT')} · {staffName(r.staffId)}</Text></View>
                  <Pressable onPress={() => r.id != null && void run(() => apiB.deleteCommissionRule(r.id!), () => void rules.reload())} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 14, color: t.gink }}>{tr('lk.delete')}</Text></Pressable>
                </Card>
              ))}
              {(rules.data ?? []).length === 0 ? <StateView icon="cash" title={tr('pr.noRules')} /> : null}
              <View style={{ maxHeight: 80 }}><Choice value={rc} onChange={setRc} options={CATS.map((c) => ({ value: c, label: tr(`pr.c.${c}` as 'pr.c.DEFAULT') }))} /></View>
              <Choice value={rt} onChange={setRt} options={[{ value: 'PERCENTAGE' as const, label: '%' }, { value: 'FIXED_AMOUNT' as const, label: tr('mk.fixed') }]} />
              <Choice value={rs} onChange={setRs} options={[{ value: '', label: tr('pr.everyone') }, ...(staff.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]} />
              <Field label={tr('mk.value')} value={rv} onChangeText={setRv} keyboardType="decimal-pad" />
              <Btn label={tr('pr.addRule')} loading={busy} disabled={!(num(rv) > 0)} onPress={() => void run(() => apiB.createCommissionRule({ businessId: sid, category: rc, type: rt, value: num(rv), staffId: rs || undefined, isActive: true }), () => { setRv(''); void rules.reload(); })} />
            </>
          ) : null}
          {tab === 'targets' ? (
            <>
              <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{month}</Text>
              {(targets.data ?? []).map((r) => (
                <Card key={String(r.staffId)} onPress={() => { setTg({ id: String(r.staffId), name: r.staffName }); setRev(String(r.revenueTarget || '')); setBk(String(r.bookingsTarget || '')); }} style={{ gap: 2 }}>
                  <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{r.staffName}</Text>
                  <Line label={tr('rp.revenue')} value={`${money(r.revenueActual, cur)} / ${money(r.revenueTarget, cur)}`} />
                  <Line label={tr('rp.bookings')} value={`${r.bookingsActual} / ${r.bookingsTarget}`} />
                </Card>
              ))}
              {(targets.data ?? []).length === 0 ? <StateView icon="spark" title={tr('pr.noTargets')} /> : null}
            </>
          ) : null}
          {tab === 'runs' ? (
            <>
              {(runs.data ?? []).map((r) => (
                <Card key={String(r.id)} onPress={() => setOpen(String(r.id))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink }}>{r.period_start} - {r.period_end}</Text><Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted }}>{money(r.total_amount, cur)}</Text></View>
                  <Pill text={tr(`pr.s.${r.status}` as 'pr.s.DRAFT')} tone={r.status === 'PAID' ? 'ok' : r.status === 'APPROVED' ? 'violet' : 'muted'} />
                </Card>
              ))}
              {(runs.data ?? []).length === 0 ? <StateView icon="wallet" title={tr('pr.noRuns')} /> : null}
              <Btn label={tr('pr.build')} loading={busy} onPress={() => { const to = new Date(); const from = addDays(to, -13); void run(() => apiB.buildPayroll(sid, toDay(from), toDay(to)), () => void runs.reload()); }} />
              <Text style={{ fontFamily: font.m, fontSize: 12.5, color: t.muted }}>{tr('pr.buildHint')}</Text>
            </>
          ) : null}
        </ScrollView>
      )}
      <BottomSheet open={!!tg} onClose={() => setTg(null)}>
        <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 8 }}>{tg?.name}</Text>
        <Field label={`${tr('pr.revTarget')} (${cur ?? 'AZN'})`} value={rev} onChangeText={setRev} keyboardType="decimal-pad" />
        <Field label={tr('pr.bkTarget')} value={bk} onChangeText={setBk} keyboardType="number-pad" />
        <Btn label={tr('common.save')} loading={busy} onPress={() => tg && void run(() => apiB.setTarget(sid, tg.id, month, { revenueTarget: num(rev) || 0, bookingsTarget: Math.round(num(bk)) || 0 }), () => { setTg(null); void targets.reload(); })} />
        <View style={{ height: 16 }} />
      </BottomSheet>
      <BottomSheet open={open != null} onClose={() => setOpen(null)}>
        {detail.data ? (
          <>
            <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink, marginBottom: 6 }}>{detail.data.period_start} - {detail.data.period_end}</Text>
            {(detail.data.lines ?? []).map((l) => <Line key={String(l.id)} label={l.staff_name ?? '-'} value={money(l.total, cur)} />)}
            <Line bold label={tr('sl.total')} value={money(detail.data.total_amount, cur)} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, paddingBottom: 16 }}>
              {detail.data.status === 'DRAFT' ? <Btn label={tr('pr.approve')} style={{ flex: 1 }} loading={busy} onPress={() => void run(() => apiB.approvePayroll(sid, detail.data!.id), () => { void detail.reload(); void runs.reload(); })} /> : null}
              {detail.data.status === 'APPROVED' ? <Btn label={tr('pr.markPaid')} style={{ flex: 1 }} loading={busy} onPress={() => void run(() => apiB.payPayroll(sid, detail.data!.id, toDay(new Date()), 'CASH'), () => { void detail.reload(); void runs.reload(); })} /> : null}
            </View>
          </>
        ) : <Skeleton rows={3} />}
      </BottomSheet>
    </Screen>
  );
}
