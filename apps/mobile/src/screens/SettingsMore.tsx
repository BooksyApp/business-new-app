import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MultiChoice, ToggleRow } from '@/components/form';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, Chip, ErrorState, Field, Header, HeroCard, Row, Screen, Section, Skeleton, StickyCta, Toggle } from '@/components/ui';
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
    if (!re.test(xf) || !re.test(xt || xf) || (xt || xf) < xf) { toast(tr('hr.badDate'), 'error'); return; }
    try { await apiX.addHoursException(sid, xf, xt || xf, xn.trim()); setXf(''); setXt(''); setXn(''); bump(); await ex.reload(); } catch (e) { toast((e as Error).message, 'error'); }
  }
  useEffect(() => {
    if (!q.data) return;
    setRows(Object.fromEntries(DAYS.map((d) => { const r = q.data!.find((x) => x.dayOfWeek === d); return [d, { on: !!r?.enabled, from: hm(r?.startTime) || '09:00', to: hm(r?.endTime) || '18:00' }]; })));
  }, [q.data]);
  async function save() {
    for (const d of DAYS) { const r = rows[d]; if (r?.on && (!ok(r.from) || !ok(r.to) || r.to <= r.from)) { toast(tr('hr.badTime'), 'error'); return; } }
    setBusy(true);
    try {
      await apiX.saveHours(sid, DAYS.map((d) => ({ dayOfWeek: d, enabled: !!rows[d]?.on, startTime: rows[d]?.from ?? '09:00', endTime: rows[d]?.to ?? '18:00' })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); toast(tr('hr.saved'), 'success'); onBack();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const set = (d: string, p: Partial<{ on: boolean; from: string; to: string }>) => setRows((m) => ({ ...m, [d]: { ...m[d], ...p } }));
  return (
    <Screen>
      <Header title={tr('hr.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : q.loading && !q.data ? <Skeleton rows={7} height={52} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }}>
          <Section title={tr('ux.secWeek')}>
            {DAYS.map((d) => rows[d] ? (
              <Card key={d} style={{ gap: 10, padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.x, fontSize: 18, letterSpacing: -0.3, color: t.ink }}>{tr(`tm.days.${d}` as 'tm.days.MONDAY')}</Text>
                    <Text style={{ fontFamily: font.m, fontSize: 14, color: rows[d].on ? t.ok : t.muted }}>{rows[d].on ? `${rows[d].from} - ${rows[d].to}` : tr('hr.closed')}</Text>
                  </View>
                  <Toggle on={rows[d].on} onChange={(v) => set(d, { on: v })} label={d} />
                </View>
                {rows[d].on ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Field label={tr('ux.opensAt')} value={rows[d].from} onChangeText={(v) => set(d, { from: v })} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                    <View style={{ flex: 1 }}><Field label={tr('ux.closesAt')} value={rows[d].to} onChangeText={(v) => set(d, { to: v })} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
                  </View>
                ) : null}
              </Card>
            ) : null)}
          </Section>
          <Section title={tr('ux.secExceptions')} hint={(ex.data ?? []).length === 0 ? tr('hr.none') : undefined}>
            {(ex.data ?? []).map((x) => (
              <Card key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: t.gsoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="cal" size={22} color={t.gink} /></View>
                <Text style={{ flex: 1, fontFamily: font.b, fontSize: 15, color: t.ink }}>{dateLabel(fromIso(x.startDate))}{x.endDate !== x.startDate ? ` - ${dateLabel(fromIso(x.endDate))}` : ''}{x.notes ? ` · ${x.notes}` : ''}</Text>
                <Pressable onPress={() => void apiX.removeHoursException(sid, x.id).then(() => { bump(); return ex.reload(); }).catch((e: Error) => toast(e.message, 'error'))} accessibilityRole="button" accessibilityLabel={tr('lk.delete')} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={22} color={t.gink} /></Pressable>
              </Card>
            ))}
            <Card style={{ gap: 2, padding: 14 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label={tr('hr.from')} value={xf} onChangeText={setXf} keyboardType="numbers-and-punctuation" maxLength={10} placeholder="2026-12-31" /></View>
                <View style={{ flex: 1 }}><Field label={tr('hr.to')} value={xt} onChangeText={setXt} keyboardType="numbers-and-punctuation" maxLength={10} /></View>
              </View>
              <Field label={tr('hr.note')} value={xn} onChangeText={setXn} />
              <Btn label={tr('hr.addException')} variant="secondary" icon="plus" disabled={!xf} onPress={() => void addEx()} />
            </Card>
          </Section>
        </ScrollView>
      )}
      {q.data ? <StickyCta label={tr('hr.save')} loading={busy} onPress={() => void save()} /> : null}
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
    try { await apiX.saveNotifSettings(sid, s); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); toast(tr('ns.saved'), 'success'); onBack(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={tr('ns.title')} subtitle={salon?.name} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !s ? <Skeleton rows={6} height={52} /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 130, gap: 12 }} showsVerticalScrollIndicator={false}>
          {([['ux.secEmails', FLAGS.filter((k) => k.startsWith('email'))], ['ux.secChannels', FLAGS.filter((k) => !k.startsWith('email'))]] as const).map(([title, list]) => (
            <Section key={title} title={tr(title)}>
              {list.map((k) => {
                const av = AVAIL[k];
                const off = av ? s[av] === false : false;
                return <ToggleRow key={k} label={tr(`ns.${k}` as 'ns.title')} hint={off ? tr('ns.unavailable') : undefined} disabled={off} value={!!s[k]} onChange={(v) => setS({ ...s, [k]: v })} />;
              })}
            </Section>
          ))}
        </ScrollView>
      )}
      {s ? <StickyCta label={tr('common.save')} loading={busy} onPress={() => void save()} /> : null}
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
    <HeroCard dark icon="crown" title={String(s.plan ?? '')} sub={tr('sub.status') + ': ' + (s.status ?? '-')} stat={s.currentPeriodEnd ? date(s.currentPeriodEnd) : undefined} statLabel={s.currentPeriodEnd ? tr('sub.until') : undefined} />
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
    if (!hmOk(qs) || !hmOk(qe) || (qs === '') !== (qe === '')) { toast(tr('pp.badTime'), 'error'); return; }
    setBusy(true);
    try {
      await apiB.savePushPrefs({ pushOff: off.push, inboxOff: off.inbox, emailOff: off.email, quietStart: qs || null, quietEnd: qe || null, staff: ids, stockThreshold: stock.trim() === '' ? null : Math.max(0, Math.round(Number(stock)) || 0) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(tr('ns.saved'), 'success'); onBack();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  const chip = (ch: 'push' | 'inbox' | 'email', k: string) => <Chip key={ch} soft label={tr(`pp.${ch}Col` as 'pp.pushCol')} icon={!off[ch].includes(k) ? 'check' : undefined} active={!off[ch].includes(k)} onPress={() => flip(ch, k)} />;
  return (
    <Screen>
      <Header title={tr('pp.title')} subtitle={tr('pp.hint')} onBack={onBack} />
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.reload()} /> : !q.data ? <Skeleton rows={6} height={52} /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}>
          <View style={{ gap: 12 }}>
            {PTYPES.map((k) => (
              <Card key={k} style={{ gap: 12 }}>
                <Text style={{ fontFamily: font.x, fontSize: 17, letterSpacing: -0.3, color: t.ink }}>{tr(`pp.t.${k}` as 'pp.t.NO_SHOW')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chip('push', k)}{chip('inbox', k)}{k.startsWith('BOOKING') ? chip('email', k) : null}</View>
              </Card>
            ))}
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink, marginTop: 22, marginBottom: 8 }}>{tr('pp.quiet')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={tr('pp.from')} value={qs} onChangeText={setQs} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
            <View style={{ flex: 1 }}><Field label={tr('pp.to')} value={qe} onChangeText={setQe} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink, marginBottom: 8 }}>{tr('pp.staff')}</Text>
          <MultiChoice value={ids} onChange={setIds} options={(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))} />
          {ids.length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 13, color: t.muted, marginTop: -6, marginBottom: 10 }}>{tr('pp.staffAll')}</Text> : null}
          <Field label={tr('pp.stock')} value={stock} onChangeText={setStock} keyboardType="number-pad" />
          <Btn label={tr('common.save')} loading={busy} onPress={() => void save()} />
        </ScrollView>
      )}
    </Screen>
  );
}
