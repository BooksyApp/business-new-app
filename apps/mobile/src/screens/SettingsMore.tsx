import { useEffect, useState, type ReactNode } from 'react';
import { toast } from '@/lib/toast';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MultiChoice } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { BottomSheet } from '@/components/BottomSheet';
import { Segmented, T } from '@/components/kit';
import { Btn, ErrorState, Field, Header, Screen, Skeleton, StickyCta, Toggle } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { apiX, type NotifSettings } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { dateLabel, fromIso } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const hm = (s?: string | null) => (s ?? '').slice(0, 5);
const ok = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Light group: a quiet sentence-case label over a plain rounded list (shared with Settings). */
export function SetGroup({ title, children }: { title?: string; children: ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 18 }}>
      {title ? <T k="sm" lines={1} color={t.muted} style={{ marginBottom: 6, marginLeft: 4 }}>{title}</T> : null}
      <View style={{ backgroundColor: t.surface, borderRadius: 16, paddingHorizontal: 16 }}>{children}</View>
    </View>
  );
}

/** One switch row: one-line label, optional one-line muted note. */
function SwitchRow({ label, note, value, onChange, disabled, first }: { label: string; note?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; first?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderTopWidth: first ? 0 : 1, borderTopColor: t.hair, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T k="t1" lines={1}>{label}</T>
        {note ? <T k="t2" lines={1} color={t.muted}>{note}</T> : null}
      </View>
      <Toggle on={value} onChange={(v) => { if (!disabled) onChange(v); }} label={label} />
    </View>
  );
}

/** İş saatləri: compact weekday rows (switch + one-line hours), hours edited in one sheet, holidays in a second. */
export function HoursEditor({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiX.hours(sid), [sid]);
  const [rows, setRows] = useState<Record<string, { on: boolean; from: string; to: string }>>({});
  const ex = useLoad(() => apiX.hoursExceptions(sid).catch(() => []), [sid]);
  const [xf, setXf] = useState(''); const [xt, setXt] = useState(''); const [xn, setXn] = useState('');
  const [xs, setXs] = useState(false); const [xo, setXo] = useState('10:00'); const [xc, setXc] = useState('16:00');
  const [xerr, setXerr] = useState(''); const [exOpen, setExOpen] = useState(false);
  const [edDay, setEdDay] = useState<string | null>(null);
  const [df, setDf] = useState(''); const [dto, setDto] = useState(''); const [derr, setDerr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function addEx() {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(xf) || !re.test(xt || xf) || (xt || xf) < xf) { setXerr(tr('hr.badDate')); return; }
    if (xs && (!ok(xo) || !ok(xc) || xc <= xo)) { setXerr(tr('hr.badTime')); return; }
    try { await apiX.addHoursException(sid, xf, xt || xf, xn.trim(), xs ? { open: xo, close: xc } : undefined); setXf(''); setXt(''); setXn(''); setXerr(''); setExOpen(false); bump(); await ex.reload(); } catch (e) { setXerr((e as Error).message); }
  }
  useEffect(() => {
    if (!q.data) return;
    setRows(Object.fromEntries(DAYS.map((d) => { const r = q.data!.find((x) => x.dayOfWeek === d); return [d, { on: !!r?.enabled, from: hm(r?.startTime) || '09:00', to: hm(r?.endTime) || '18:00' }]; })));
  }, [q.data]);
  async function save() {
    for (const d of DAYS) { const r = rows[d]; if (r?.on && (!ok(r.from) || !ok(r.to) || r.to <= r.from)) { setErr(tr('hr.badTime')); return; } }
    setErr(''); setBusy(true);
    try {
      await apiX.saveHours(sid, DAYS.map((d) => ({ dayOfWeek: d, enabled: !!rows[d]?.on, startTime: rows[d]?.from ?? '09:00', endTime: rows[d]?.to ?? '18:00' })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); toast(tr('hr.saved'), 'success'); onBack();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const set = (d: string, p: Partial<{ on: boolean; from: string; to: string }>) => setRows((m) => ({ ...m, [d]: { ...m[d], ...p } }));
  const dayName = (d: string) => tr(`tm.days.${d}` as 'tm.days.MONDAY');
  const openDay = (d: string) => { const r = rows[d]; if (!r) return; setDf(r.from); setDto(r.to); setDerr(''); setEdDay(d); };
  function applyDay() {
    if (!edDay) return;
    if (!ok(df) || !ok(dto) || dto <= df) { setDerr(tr('hr.badTime')); return; }
    set(edDay, { from: df, to: dto }); setEdDay(null);
  }
  function copyAll() {
    const src = DAYS.map((d) => rows[d]).find((r) => r?.on) ?? rows[DAYS[0]];
    if (!src) return;
    setRows((m) => Object.fromEntries(DAYS.map((d) => [d, { ...m[d], from: src.from, to: src.to }])));
  }
  return (
    <Screen>
      <Header title={tr('hr.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={7} height={44} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}>
          <SetGroup title={tr('ux.secWeek')}>
            {DAYS.map((d, i) => rows[d] ? (
              <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.hair }}>
                <T k="t1" lines={1} style={{ width: 52 }}>{dayName(d)}</T>
                <Pressable onPress={() => openDay(d)} disabled={!rows[d].on} accessibilityRole="button" accessibilityLabel={`${dayName(d)} ${rows[d].from} - ${rows[d].to}`} noScale style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                  <T k="body" lines={1} color={rows[d].on ? t.ink : t.muted}>{rows[d].on ? `${rows[d].from} \u2013 ${rows[d].to}` : tr('hr.closed')}</T>
                </Pressable>
                {rows[d].on ? <Icon name="chev" size={14} color={t.ink3} /> : null}
                <Toggle on={rows[d].on} onChange={(v) => set(d, { on: v })} label={dayName(d)} />
              </View>
            ) : null)}
          </SetGroup>
          <Pressable onPress={copyAll} accessibilityRole="button" noScale style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginLeft: 4 }}>
            <T k="t2" lines={1} color={t.vtext}>{tr('hr.copyAll')}</T>
          </Pressable>
          <SetGroup title={tr('ux.secExceptions')}>
            {(ex.data ?? []).map((x, i) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.hair }}>
                <T k="body" lines={1} style={{ flex: 1 }}>{dateLabel(fromIso(x.startDate))}{x.endDate !== x.startDate ? ` - ${dateLabel(fromIso(x.endDate))}` : ''}{!x.closed && x.openTime ? ` \u00b7 ${hm(x.openTime)}-${hm(x.closeTime ?? '')}` : ''}{x.notes ? ` \u00b7 ${x.notes}` : ''}</T>
                <Pressable onPress={() => void apiX.removeHoursException(sid, x.id).then(() => { bump(); return ex.reload(); }).catch((e: Error) => toast(e.message, 'error'))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={20} color={t.ink3} /></Pressable>
              </View>
            ))}
            <Pressable onPress={() => { setXerr(''); setExOpen(true); }} accessibilityRole="button" noScale style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderTopWidth: (ex.data ?? []).length ? 1 : 0, borderTopColor: t.hair }}>
              <Icon name="plus" size={18} color={t.vtext} />
              <T k="t1" lines={1} color={t.vtext}>{tr('hr.addException')}</T>
            </Pressable>
          </SetGroup>
          {err ? <T k="t2" color={t.gink} style={{ marginTop: 12, marginLeft: 4 }}>{err}</T> : null}
        </ScrollView>
      )}
      {q.data ? <StickyCta label={tr('hr.save')} loading={busy} onPress={() => void save()} /> : null}
      <BottomSheet open={edDay !== null} onClose={() => setEdDay(null)}>
        <T k="h2" lines={1} style={{ marginBottom: 10 }}>{edDay ? dayName(edDay) : ''}</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('ux.opensAt')} value={df} onChangeText={setDf} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          <View style={{ flex: 1 }}><Field label={tr('ux.closesAt')} value={dto} onChangeText={setDto} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
        </View>
        {derr ? <T k="t2" color={t.gink} style={{ marginBottom: 8 }}>{derr}</T> : null}
        <Btn label={tr('hr.done')} onPress={applyDay} />
      </BottomSheet>
      <BottomSheet open={exOpen} onClose={() => setExOpen(false)}>
        <T k="h2" lines={1} style={{ marginBottom: 10 }}>{tr('hr.addException')}</T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('hr.from')} value={xf} onChangeText={setXf} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="2026-12-31" /></View>
          <View style={{ flex: 1 }}><Field label={tr('hr.to')} value={xt} onChangeText={setXt} keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        </View>
        <Field label={tr('hr.note')} value={xn} onChangeText={setXn} />
        <SwitchRow first label={tr('hx.exSpecial')} value={xs} onChange={setXs} />
        {xs ? (<View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={tr('hx.exOpenFrom')} value={xo} onChangeText={setXo} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          <View style={{ flex: 1 }}><Field label={tr('hx.exOpenTo')} value={xc} onChangeText={setXc} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
        </View>) : null}
        {xerr ? <T k="t2" color={t.gink} style={{ marginBottom: 8 }}>{xerr}</T> : null}
        <Btn label={tr('hr.addException')} icon="plus" disabled={!xf} onPress={() => void addEx()} />
      </BottomSheet>
    </Screen>
  );
}

const FLAGS = ['emailConfirmation', 'emailReminder', 'emailCancellation', 'emailReschedule', 'emailWaitlist', 'emailReviewRequest', 'salonAlerts', 'smsEnabled', 'pushEnabled', 'whatsappEnabled'] as const;
const AVAIL: Partial<Record<(typeof FLAGS)[number], 'smsAvailable' | 'pushAvailable' | 'whatsappAvailable'>> = { smsEnabled: 'smsAvailable', pushEnabled: 'pushAvailable', whatsappEnabled: 'whatsappAvailable' };

/** Bildiriş seçimləri: which e-mails / SMS / push / WhatsApp the salon sends. */
export function NotifEditor({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiX.notifSettings(sid), [sid]);
  const [s, setS] = useState<NotifSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  async function save() {
    if (!s) return;
    setErr(''); setBusy(true);
    try { await apiX.saveNotifSettings(sid, s); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); toast(tr('ns.saved'), 'success'); onBack(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('ns.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !s ? <Skeleton rows={6} height={44} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
          {([['ux.secEmails', FLAGS.filter((k) => k.startsWith('email'))], ['ux.secChannels', FLAGS.filter((k) => !k.startsWith('email'))]] as const).map(([title, list]) => (
            <SetGroup key={title} title={tr(title)}>
              {list.map((k, i) => {
                const av = AVAIL[k];
                const off = av ? s[av] === false : false;
                return <SwitchRow key={k} first={i === 0} label={tr(`ns.${k}` as 'ns.title')} note={off ? tr('ns.unavailable') : undefined} disabled={off} value={!!s[k]} onChange={(v) => setS({ ...s, [k]: v })} />;
              })}
            </SetGroup>
          ))}
          {err ? <T k="t2" color={t.gink} style={{ marginTop: 12, marginLeft: 4 }}>{err}</T> : null}
        </ScrollView>
      )}
      {s ? <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} /> : null}
    </Screen>
  );
}

/** Abunəlik: read-only plan / status line (billing stays on the web). */
export function SubscriptionCard() {
  const { t } = useTheme();
  const { salon } = useApp();
  const q = useLoad(() => apiX.subscription(salon?.id ?? '').catch(() => null), [salon?.id]);
  const s = q.data;
  if (!s) return null;
  const until = s.currentPeriodEnd ? dateLabel(fromIso(s.currentPeriodEnd)) : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.vsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="crown" size={20} color={t.vtext} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T k="t1" lines={1}>{String(s.plan ?? '')}</T>
        <T k="t2" lines={1} color={t.muted}>{(s.status ?? '-') + (until ? ` \u00b7 ${tr('sub.until')} ${until}` : '')}</T>
      </View>
    </View>
  );
}

const PTYPES = ['BOOKING_NEW', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'BOOKING_LATE', 'NO_SHOW', 'REVIEW_NEW', 'WAITLIST_NEW', 'PAYMENT', 'STOCK_LOW'] as const;
const PGROUPS: { title: 'pp.gBook' | 'pp.gGuests' | 'pp.gMoney'; keys: readonly (typeof PTYPES)[number][] }[] = [
  { title: 'pp.gBook', keys: ['BOOKING_NEW', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'BOOKING_LATE', 'NO_SHOW'] },
  { title: 'pp.gGuests', keys: ['REVIEW_NEW', 'WAITLIST_NEW'] },
  { title: 'pp.gMoney', keys: ['PAYMENT', 'STOCK_LOW'] },
];
const hmOk = (s: string) => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Bildiriş ayarları: pick a channel, then one switch per event type; quiet hours, followed specialists, own stock level. */
export function PushPrefsEditor({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiB.pushPrefs(), []);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const [off, setOff] = useState<{ push: string[]; inbox: string[]; email: string[] }>({ push: [], inbox: [], email: [] });
  const [ch, setCh] = useState<'push' | 'inbox' | 'email'>('push');
  const [qs, setQs] = useState(''); const [qe, setQe] = useState(''); const [ids, setIds] = useState<string[]>([]); const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const p = q.data; if (!p) return;
    setOff({ push: p.pushOff, inbox: p.inboxOff, email: p.emailOff });
    setQs((p.quietStart ?? '').slice(0, 5)); setQe((p.quietEnd ?? '').slice(0, 5)); setIds(p.staff); setStock(p.stockThreshold != null ? String(p.stockThreshold) : '');
  }, [q.data]);
  const flip = (c: 'push' | 'inbox' | 'email', k: string) => setOff((o) => ({ ...o, [c]: o[c].includes(k) ? o[c].filter((x) => x !== k) : [...o[c], k] }));
  async function save() {
    if (!hmOk(qs) || !hmOk(qe) || (qs === '') !== (qe === '')) { setErr(tr('pp.badTime')); return; }
    setErr(''); setBusy(true);
    try {
      await apiB.savePushPrefs({ pushOff: off.push, inboxOff: off.inbox, emailOff: off.email, quietStart: qs || null, quietEnd: qe || null, staff: ids, stockThreshold: stock.trim() === '' ? null : Math.max(0, Math.round(Number(stock)) || 0) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(tr('ns.saved'), 'success'); onBack();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('pp.title')} subtitle={tr('pp.hint')} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !q.data ? <Skeleton rows={6} height={44} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130 }}>
          <T k="sm" lines={1} color={t.muted} style={{ marginTop: 6, marginBottom: 6, marginLeft: 4 }}>{tr('pp.where')}</T>
          <Segmented items={[{ k: 'push' as const, label: tr('pp.pushCol') }, { k: 'inbox' as const, label: tr('pp.inboxCol') }, { k: 'email' as const, label: tr('pp.emailCol') }]} value={ch} onChange={setCh} />
          {PGROUPS.map((g) => {
            const keys = g.keys.filter((k) => ch !== 'email' || k.startsWith('BOOKING'));
            return keys.length === 0 ? null : (
              <SetGroup key={g.title} title={tr(g.title)}>
                {keys.map((k, i) => <SwitchRow key={k} first={i === 0} label={tr(`pp.t.${k}` as 'pp.t.NO_SHOW')} value={!off[ch].includes(k)} onChange={() => flip(ch, k)} />)}
              </SetGroup>
            );
          })}
          <SetGroup title={tr('pp.quiet')}>
            <View style={{ flexDirection: 'row', gap: 10, paddingTop: 8 }}>
              <View style={{ flex: 1 }}><Field label={tr('pp.from')} value={qs} onChangeText={setQs} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
              <View style={{ flex: 1 }}><Field label={tr('pp.to')} value={qe} onChangeText={setQe} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            </View>
          </SetGroup>
          <SetGroup title={tr('pp.staff')}>
            <View style={{ paddingVertical: 12 }}>
              <MultiChoice value={ids} onChange={setIds} options={(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))} />
              {ids.length === 0 ? <T k="t2" lines={1} color={t.muted}>{tr('pp.staffAll')}</T> : null}
            </View>
          </SetGroup>
          <SetGroup>
            <View style={{ paddingTop: 8 }}><Field label={tr('pp.stock')} value={stock} onChangeText={setStock} keyboardType="number-pad" /></View>
          </SetGroup>
          {err ? <T k="t2" color={t.gink} style={{ marginTop: 12, marginLeft: 4 }}>{err}</T> : null}
        </ScrollView>
      )}
      {q.data ? <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} /> : null}
    </Screen>
  );
}
