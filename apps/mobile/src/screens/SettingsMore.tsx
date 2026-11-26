import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MultiChoice, ToggleRow } from '@/components/form';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Row, Screen, Skeleton } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api } from '@/lib/api';
import { apiB } from '@/lib/api-biz';
import { apiX, type NotifSettings } from '@/lib/api-ext';
import { useApp } from '@/lib/app';
import { dateLabel, fromIso } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
const hm = (s?: string | null) => (s ?? '').slice(0, 5);
const ok = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** İş saatləri: open/closed switch and from-to per weekday. */
export function HoursEditor({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiX.hours(sid), [sid]);
  const [rows, setRows] = useState<Record<string, { on: boolean; from: string; to: string }>>({});
  const ex = useLoad(() => apiX.hoursExceptions(sid).catch(() => []), [sid]);
  const [xf, setXf] = useState(''); const [xt, setXt] = useState(''); const [xn, setXn] = useState('');
  const [busy, setBusy] = useState(false);
  async function addEx() {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(xf) || !re.test(xt || xf) || (xt || xf) < xf) { Alert.alert(tr('common.error'), tr('hr.badDate')); return; }
    try { await apiX.addHoursException(sid, xf, xt || xf, xn.trim()); setXf(''); setXt(''); setXn(''); bump(); await ex.reload(); } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); }
  }
  useEffect(() => {
    if (!q.data) return;
    setRows(Object.fromEntries(DAYS.map((d) => { const r = q.data!.find((x) => x.dayOfWeek === d); return [d, { on: !!r?.enabled, from: hm(r?.startTime) || '09:00', to: hm(r?.endTime) || '18:00' }]; })));
  }, [q.data]);
  async function save() {
    for (const d of DAYS) { const r = rows[d]; if (r?.on && (!ok(r.from) || !ok(r.to) || r.to <= r.from)) { Alert.alert(tr('common.error'), tr('hr.badTime')); return; } }
    setBusy(true);
    try {
      await apiX.saveHours(sid, DAYS.map((d) => ({ dayOfWeek: d, enabled: !!rows[d]?.on, startTime: rows[d]?.from ?? '09:00', endTime: rows[d]?.to ?? '18:00' })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); Alert.alert(tr('hr.saved')); onBack();
    } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  const set = (d: string, p: Partial<{ on: boolean; from: string; to: string }>) => setRows((m) => ({ ...m, [d]: { ...m[d], ...p } }));
  return (
    <Screen>
      <Header title={tr('hr.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={7} height={52} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          {DAYS.map((d) => rows[d] ? (
            <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Pressable onPress={() => set(d, { on: !rows[d].on })} accessibilityRole="button" accessibilityState={{ selected: rows[d].on }} style={{ width: 64, height: 44, borderRadius: 14, backgroundColor: rows[d].on ? t.vsoft : t.fill, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: font.b, fontSize: 14, color: rows[d].on ? t.vtext : t.muted }}>{tr(`tm.days.${d}` as 'tm.days.MONDAY')}</Text>
              </Pressable>
              {rows[d].on ? (<>
                <Field label="" value={rows[d].from} onChangeText={(v) => set(d, { from: v })} keyboardType="numbers-and-punctuation" maxLength={5} style={{ flex: 1, textAlign: 'center' }} />
                <Text style={{ color: t.muted }}>-</Text>
                <Field label="" value={rows[d].to} onChangeText={(v) => set(d, { to: v })} keyboardType="numbers-and-punctuation" maxLength={5} style={{ flex: 1, textAlign: 'center' }} />
              </>) : <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('hr.closed')}</Text>}
            </View>
          ) : null)}
          <Btn label={tr('hr.save')} loading={busy} onPress={() => void save()} style={{ marginTop: 12 }} />
          <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginTop: 24, marginBottom: 8 }}>{tr('hr.exceptions')}</Text>
          {(ex.data ?? []).length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted, marginBottom: 8 }}>{tr('hr.none')}</Text> : (ex.data ?? []).map((x) => (
            <Card key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 8 }}>
              <Text style={{ flex: 1, fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{dateLabel(fromIso(x.startDate))}{x.endDate !== x.startDate ? ` - ${dateLabel(fromIso(x.endDate))}` : ''}{x.notes ? ` · ${x.notes}` : ''}</Text>
              <Pressable onPress={() => void apiX.removeHoursException(sid, x.id).then(() => { bump(); return ex.reload(); }).catch((e: Error) => Alert.alert(tr('common.error'), e.message))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')}><Text style={{ fontFamily: font.b, fontSize: 14, color: t.gink }}>{tr('lk.delete')}</Text></Pressable>
            </Card>
          ))}
          <Field label={tr('hr.from')} value={xf} onChangeText={setXf} keyboardType="numbers-and-punctuation" maxLength={10} />
          <Field label={tr('hr.to')} value={xt} onChangeText={setXt} keyboardType="numbers-and-punctuation" maxLength={10} />
          <Field label={tr('hr.note')} value={xn} onChangeText={setXn} />
          <Btn label={tr('hr.addException')} variant="secondary" icon="plus" disabled={!xf} onPress={() => void addEx()} />
        </ScrollView>
      )}
    </Screen>
  );
}

const FLAGS = ['emailConfirmation', 'emailReminder', 'emailCancellation', 'emailReschedule', 'emailWaitlist', 'emailReviewRequest', 'salonAlerts', 'smsEnabled', 'pushEnabled', 'whatsappEnabled'] as const;
const AVAIL: Partial<Record<(typeof FLAGS)[number], 'smsAvailable' | 'pushAvailable' | 'whatsappAvailable'>> = { smsEnabled: 'smsAvailable', pushEnabled: 'pushAvailable', whatsappEnabled: 'whatsappAvailable' };

/** Bildiriş seçimləri: which e-mails / SMS / push / WhatsApp the salon sends. */
export function NotifEditor({ onBack }: { onBack: () => void }) {
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiX.notifSettings(sid), [sid]);
  const [s, setS] = useState<NotifSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  async function save() {
    if (!s) return;
    setBusy(true);
    try { await apiX.saveNotifSettings(sid, s); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); Alert.alert(tr('ns.saved')); onBack(); }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('ns.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !s ? <Skeleton rows={6} height={52} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          <Card style={{ paddingVertical: 4 }}>
            {FLAGS.map((k) => {
              const av = AVAIL[k];
              const off = av ? s[av] === false : false;
              return <ToggleRow key={k} label={tr(`ns.${k}` as 'ns.title')} hint={off ? tr('ns.unavailable') : undefined} disabled={off} value={!!s[k]} onChange={(v) => setS({ ...s, [k]: v })} />;
            })}
          </Card>
          <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} style={{ marginTop: 14 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

/** Abunəlik: read-only plan / status block (billing stays on the web). */
export function SubscriptionCard() {
  const { salon } = useApp();
  const q = useLoad(() => apiX.subscription(salon?.id ?? '').catch(() => null), [salon?.id]);
  const s = q.data;
  if (!s) return null;
  const date = (v?: string | null) => (v ? dateLabel(fromIso(v)) : '-');
  return (
    <Card style={{ paddingVertical: 8 }}>
      <Row label={tr('sub.plan')} value={s.plan} />
      <Row label={tr('sub.status')} value={s.status} />
      {s.trialEndsAt ? <Row label={tr('sub.trial')} value={date(s.trialEndsAt)} /> : null}
      {s.currentPeriodEnd ? <Row label={tr('sub.until')} value={date(s.currentPeriodEnd)} /> : null}
    </Card>
  );
}

const PTYPES = ['BOOKING_NEW', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'BOOKING_LATE', 'NO_SHOW', 'REVIEW_NEW', 'WAITLIST_NEW', 'PAYMENT', 'STOCK_LOW'] as const;
const hmOk = (s: string) => s === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Bildiriş ayarları: per event type, push / in-app / e-mail switches, quiet hours, followed specialists, own stock level. */
export function PushPrefsEditor({ onBack }: { onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiB.pushPrefs(), []);
  const staff = useLoad(() => api.staff(sid), [sid]);
  const [off, setOff] = useState<{ push: string[]; inbox: string[]; email: string[] }>({ push: [], inbox: [], email: [] });
  const [qs, setQs] = useState(''); const [qe, setQe] = useState(''); const [ids, setIds] = useState<string[]>([]); const [stock, setStock] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const p = q.data; if (!p) return;
    setOff({ push: p.pushOff, inbox: p.inboxOff, email: p.emailOff });
    setQs((p.quietStart ?? '').slice(0, 5)); setQe((p.quietEnd ?? '').slice(0, 5)); setIds(p.staff); setStock(p.stockThreshold != null ? String(p.stockThreshold) : '');
  }, [q.data]);
  const flip = (ch: 'push' | 'inbox' | 'email', k: string) => setOff((o) => ({ ...o, [ch]: o[ch].includes(k) ? o[ch].filter((x) => x !== k) : [...o[ch], k] }));
  async function save() {
    if (!hmOk(qs) || !hmOk(qe) || (qs === '') !== (qe === '')) { Alert.alert(tr('common.error'), tr('pp.badTime')); return; }
    setBusy(true);
    try {
      await apiB.savePushPrefs({ pushOff: off.push, inboxOff: off.inbox, emailOff: off.email, quietStart: qs || null, quietEnd: qe || null, staff: ids, stockThreshold: stock.trim() === '' ? null : Math.max(0, Math.round(Number(stock)) || 0) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(tr('ns.saved')); onBack();
    } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  const cell = (ch: 'push' | 'inbox' | 'email', k: string) => <Switch value={!off[ch].includes(k)} onValueChange={() => flip(ch, k)} accessibilityLabel={`${tr(`pp.t.${k}` as 'pp.t.NO_SHOW')} ${tr(`pp.${ch}Col` as 'pp.pushCol')}`} trackColor={{ true: t.violet, false: t.fill2 }} />;
  return (
    <Screen>
      <Header title={tr('pp.title')} subtitle={tr('pp.hint')} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !q.data ? <Skeleton rows={6} height={52} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
          <Card style={{ paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <View style={{ flex: 1 }} />
              {(['pushCol', 'inboxCol', 'emailCol'] as const).map((c) => <Text key={c} style={{ width: 66, textAlign: 'center', fontFamily: font.b, fontSize: 12, color: t.muted }}>{tr(`pp.${c}` as 'pp.pushCol')}</Text>)}
            </View>
            {PTYPES.map((k) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ flex: 1, fontFamily: font.s, fontSize: 14.5, color: t.ink }}>{tr(`pp.t.${k}` as 'pp.t.NO_SHOW')}</Text>
                <View style={{ width: 66, alignItems: 'center' }}>{cell('push', k)}</View>
                <View style={{ width: 66, alignItems: 'center' }}>{cell('inbox', k)}</View>
                <View style={{ width: 66, alignItems: 'center' }}>{k.startsWith('BOOKING') ? cell('email', k) : null}</View>
              </View>
            ))}
          </Card>
          <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginTop: 18, marginBottom: 6 }}>{tr('pp.quiet')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={tr('pp.from')} value={qs} onChangeText={setQs} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            <View style={{ flex: 1 }}><Field label={tr('pp.to')} value={qe} onChangeText={setQe} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 18, color: t.ink, marginBottom: 6 }}>{tr('pp.staff')}</Text>
          <MultiChoice value={ids} onChange={setIds} options={(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))} />
          {ids.length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginTop: -6, marginBottom: 10 }}>{tr('pp.staffAll')}</Text> : null}
          <Field label={tr('pp.stock')} value={stock} onChangeText={setStock} keyboardType="number-pad" />
          <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} />
        </ScrollView>
      )}
    </Screen>
  );
}
