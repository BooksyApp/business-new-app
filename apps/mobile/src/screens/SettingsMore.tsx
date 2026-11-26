import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ToggleRow } from '@/components/form';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Btn, Card, ErrorState, Field, Header, Row, Screen, Skeleton } from '@/components/ui';
import { t as tr } from '@/i18n';
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
  const [busy, setBusy] = useState(false);
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
