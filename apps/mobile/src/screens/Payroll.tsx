import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, Line, TabBar, num } from '@/components/form';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, Btn, Card, Chip, ErrorState, Field, Header, Pill, Ring, Screen, Skeleton, StateView } from '@/components/ui';
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
  const [tab, setTab] = useState<'rules' | 'targets' | 'runs' | 'time'>('rules');
  const [mo, setMo] = useState(0);
  const month = toDay(new Date(new Date().getFullYear(), new Date().getMonth() - mo, 1)).slice(0, 7);
  const rules = useLoad(() => apiB.commissionRules(sid), [sid]);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const targets = useLoad(() => apiB.targets(sid, month).catch(() => []), [sid, month]);
  const clocks = useLoad(() => (tab === 'time' ? apiB.clockedIn(sid).catch(() => []) : Promise.resolve([])), [sid, tab]);
  const sheet = useLoad(() => (tab === 'time' ? apiB.timesheets(sid, toDay(addDays(new Date(), -13)), toDay(new Date())).catch(() => null) : Promise.resolve(null)), [sid, tab]);
  const runs = useLoad(() => apiB.payrollRuns(sid).catch(() => []), [sid]);
  const [rc, setRc] = useState<(typeof CATS)[number]>('DEFAULT'); const [rt, setRt] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE'); const [rv, setRv] = useState(''); const [rs, setRs] = useState('');
  const [tg, setTg] = useState<{ id: string; name: string } | null>(null); const [rev, setRev] = useState(''); const [bk, setBk] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const detail = useLoad(() => (open != null ? apiB.payrollRun(sid, open) : Promise.resolve(null)), [sid, open]);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => { setBusy(true); try { await fn(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); after?.(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } };
  const q = tab === 'rules' ? rules : tab === 'targets' ? targets : tab === 'time' ? clocks : runs;
  const staffName = (id?: string | number) => (staff.data ?? []).find((s) => String(s.id) === String(id))?.name ?? tr('pr.everyone');
  return (
    <Screen>
      <Header title={tr('pr.title')} subtitle={salon?.name} onBack={onBack} />
      <TabBar value={tab} onChange={setTab} tabs={[{ k: 'rules', label: tr('pr.rules') }, { k: 'targets', label: tr('pr.targets') }, { k: 'runs', label: tr('pr.runs') }, { k: 'time', label: tr('pr.time') }]} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={4} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, gap: 12 }}>
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
              <View style={{ flexDirection: 'row', gap: 8 }}>{[0, 1, 2].map((i) => <Chip key={i} label={toDay(new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)).slice(0, 7)} active={mo === i} onPress={() => setMo(i)} />)}</View>
              {(targets.data ?? []).map((r) => {
                const pct = r.revenueTarget ? r.revenueActual / r.revenueTarget : 0;
                const person = (staff.data ?? []).find((x) => String(x.id) === String(r.staffId));
                return (
                  <Card key={String(r.staffId)} onPress={() => { setTg({ id: String(r.staffId), name: r.staffName }); setRev(String(r.revenueTarget || '')); setBk(String(r.bookingsTarget || '')); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
                    <Avatar name={r.staffName} size={60} uri={person?.avatarUrl} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{r.staffName}</Text>
                      <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{money(r.revenueActual, cur)}<Text style={{ fontFamily: font.m, color: t.muted }}> / {money(r.revenueTarget, cur)}</Text></Text>
                      <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{r.bookingsActual} / {r.bookingsTarget} {tr('rp.bookings').toLowerCase()}</Text>
                    </View>
                    <Ring value={pct} size={66} />
                  </Card>
                );
              })}
              {(targets.data ?? []).length === 0 ? <StateView icon="spark" title={tr('pr.noTargets')} /> : null}
            </>
          ) : null}
          {tab === 'time' ? (
            <>
              {(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => {
                const on = (clocks.data ?? []).some((c) => String(c.staff_id) === String(s.id));
                return (
                  <Card key={String(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <Avatar name={s.name} size={56} uri={s.avatarUrl} />
                    <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{s.name}</Text>{on ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.ok }}>{tr('pr.clockedIn')}</Text> : null}</View>
                    <Btn label={on ? tr('pr.clockOut') : tr('pr.clockIn')} variant={on ? 'danger' : 'secondary'} loading={busy} onPress={() => void run(() => (on ? apiB.clockOut(sid, s.id) : apiB.clockIn(sid, s.id)), () => { void clocks.reload(); void sheet.reload(); })} />
                  </Card>
                );
              })}
              {(sheet.data?.byStaff ?? []).length ? <Text style={{ fontFamily: font.x, fontSize: 16, color: t.ink, marginTop: 8 }}>{tr('pr.hours14')}</Text> : null}
              {(sheet.data?.byStaff ?? []).map((r) => <Card key={String(r.staff_id)}><Line label={r.staff_name ?? '-'} value={`${Number(r.hours).toFixed(1)} h · ${money(Number(r.pay), cur)}`} /></Card>)}
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
