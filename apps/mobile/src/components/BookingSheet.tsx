import React, { useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { Alert, Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Avatar, Btn, Chip, Field, Pill, Skeleton } from '@/components/ui';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { t as tr } from '@/i18n';
import { apiM } from '@/lib/api-more';
import { api, ApiError, toDay, type Appointment } from '@/lib/api';
import { useApp } from '@/lib/app';
import { recallClient } from '@/lib/client-cache';
import { addDays, dateLabel, digits, fromIso, fromMin, hhmm, money, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { cardShadow, font, mesh } from '@/theme/tokens';

type Step = 'view' | 'cancel' | 'reschedule' | 'wa';
const TONE = { PENDING: 'violet', CONFIRMED: 'violet', COMPLETED: 'ok', CANCELLED: 'muted', NO_SHOW: 'guava' } as const;

/** Booking sheet opened from a calendar tile: details, contact, late notice and the status actions (confirm, reschedule, no-show, cancel). */
export function BookingSheet({ appt, onClose }: { appt: Appointment | null; onClose: () => void }) {
  const last = useRef<Appointment | null>(null);
  if (appt) last.current = appt;
  const a = last.current;
  return (
    <BottomSheet open={!!appt} onClose={onClose}>
      {a ? <Body key={a.id} initial={a} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function Body({ initial, onClose }: { initial: Appointment; onClose: () => void }) {
  const { t } = useTheme();
  const { height: H } = useWindowDimensions();
  const { salon, bump } = useApp();
  const live = useLoad(() => api.appointment(initial.id), [initial.id]);
  const a = live.data ?? initial;
  const [step, setStep] = useState<Step>('view');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const cur = salon?.currency;
  const open = a.status === 'PENDING' || a.status === 'CONFIRMED';
  const late = (a.lateMinutes ?? 0) > 0;
  const phone = a.clientPhone;

  async function run(fn: () => Promise<unknown>, close = false) {
    setBusy(true);
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump();
      if (close) onClose();
      else await live.reload();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ maxHeight: H * 0.78 }} contentContainerStyle={{ paddingBottom: 28, gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {step === 'view' ? (
        <>
          {/* `.tk` ticket: mesh top (status + number, avatar + client), dashed cut, 2-column grid of k/v */}
          <View style={{ backgroundColor: t.surface, borderRadius: 24, overflow: 'hidden', ...cardShadow }}>
            <View style={{ padding: 20, paddingVertical: 18, experimental_backgroundImage: mesh } as any}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
                {late ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingLeft: 9, paddingRight: 12, borderRadius: 14, backgroundColor: t.gsoft }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.guava }} />
                    <Text style={{ fontFamily: font.x, fontSize: 14, color: t.gink }}>{tr('calendar.late', { min: a.lateMinutes ?? 0 })}</Text>
                  </View>
                ) : <Pill text={tr(`status.${a.status}`)} tone={TONE[a.status] ?? 'violet'} />}
                <Text style={{ fontFamily: font.b, fontSize: 14, color: t.muted }}>№ {String(a.id).slice(0, 6).toUpperCase()}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 }}>
                <Avatar name={a.clientName ?? ''} size={84} uri={a.clientId != null ? (recallClient(String(a.clientId)) as { avatarUrl?: string | null } | undefined)?.avatarUrl : null} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 28, letterSpacing: -0.8, color: t.ink }}>{a.clientName || '-'}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 14.5, color: t.muted }}>{a.clientPhone || dateLabel(fromIso(a.appointmentDate))}</Text>
                </View>
              </View>
            </View>
            <View style={{ marginHorizontal: 18, borderTopWidth: 2, borderStyle: 'dashed', borderColor: t.line }} />
            <View style={{ padding: 20, paddingVertical: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 12 }}>
              {([
                ['appt.service', a.serviceName], ['appt.team', a.staffName], ['appt.time', `${hhmm(a.startTime)} – ${hhmm(a.endTime)}`],
                ['appt.payment', a.paymentStatus === 'PAID' ? tr('appt.paid') : money(a.price, cur) !== '—' ? `${money(a.price, cur)} · ${tr('appt.unpaid')}` : tr('appt.atSalon')],
              ] as const).map(([k, v]) => (
                <View key={k} style={{ width: '47%' }}>
                  <Text style={{ fontFamily: font.x, fontSize: 14, letterSpacing: 1.12, color: t.muted }}>{tr(k).toUpperCase()}</Text>
                  <Text numberOfLines={2} style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 2 }}>{v || '-'}</Text>
                </View>
              ))}
              {a.depositAmount ? (
                <View style={{ width: '47%' }}>
                  <Text style={{ fontFamily: font.x, fontSize: 14, letterSpacing: 1.12, color: t.muted }}>{tr('appt.deposit').toUpperCase()}</Text>
                  <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 2 }}>{money(a.depositAmount, cur)}{a.depositPaid ? ' ✓' : ''}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {a.status !== 'CANCELLED' && a.status !== 'NO_SHOW' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
              {(['PENDING', 'CONFIRMED', 'COMPLETED'] as const).map((st, i, arr) => {
                const idx = arr.indexOf(a.status as 'PENDING'); const done = i <= idx;
                return (
                  <React.Fragment key={st}>
                    <View style={{ alignItems: 'center', gap: 6, width: 78 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? t.violet : t.fill2, alignItems: 'center', justifyContent: 'center' }}>{done ? <Icon name="check" size={16} color="#fff" /> : null}</View>
                      <Text numberOfLines={1} style={{ fontFamily: i === idx ? font.x : font.s, fontSize: 13, color: i === idx ? t.ink : t.muted }}>{tr(`status.${st}`)}</Text>
                    </View>
                    {i < arr.length - 1 ? <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < idx ? t.violet : t.fill2, marginBottom: 20 }} /> : null}
                  </React.Fragment>
                );
              })}
            </View>
          ) : null}
          {a.notes ? (
            <View style={{ borderRadius: 16, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, paddingHorizontal: 16, paddingTop: 9, paddingBottom: 10, minHeight: 58 }}>
              <Text style={{ fontFamily: font.s, fontSize: 14, color: t.muted }}>{tr('appt.salonNote')}</Text>
              <Text style={{ fontFamily: font.s, fontSize: 16, color: t.ink }}>{a.notes}</Text>
            </View>
          ) : null}
          {live.loading && !live.data ? <Skeleton rows={1} height={20} /> : null}
          {open ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {a.status === 'PENDING' ? <Btn label={tr('appt.arrived')} icon="check" loading={busy} style={{ flex: 1 }} onPress={() => void run(() => api.confirmAppointment(a.id))} /> : null}
              <Btn label={tr('appt.move')} icon="repeat" variant="secondary" style={{ flex: 1 }} onPress={() => setStep('reschedule')} />
            </View>
          ) : null}
          {open ? <Btn label={tr('appt.complete')} icon="check-badge" variant="secondary" loading={busy} onPress={() => void run(() => api.completeAppointment(a.id))} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
            {phone ? (
              <Pressable onPress={() => setStep('wa')} accessibilityRole="button" accessibilityLabel={tr('ux.waRemind')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <Icon name="chat" size={20} color={t.vtext} />
                <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.vtext }}>{open ? tr('ux.waRemind') : tr('appt.messageClient')}</Text>
              </Pressable>
            ) : <View />}
            {open ? (
              <View style={{ flexDirection: 'row', gap: 18 }}>
                <Pressable onPress={() => void run(() => api.noShow(a.id))} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.muted }}>{tr('appt.noShow')}</Text></Pressable>
                <Pressable onPress={() => setStep('cancel')} accessibilityRole="button"><Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.gink }}>{tr('appt.cancel')}</Text></Pressable>
              </View>
            ) : null}
          </View>
          {phone ? <Btn label={tr('common.call')} icon="phone" variant="secondary" onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
        </>
      ) : null}

      {step === 'cancel' ? (
        <>
          <Text style={{ fontFamily: font.x, fontSize: 20, color: t.ink }}>{tr('appt.cancelTitle')}</Text>
          <Field label={tr('appt.cancelReason')} value={reason} onChangeText={setReason} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={() => setStep('view')} />
            <Btn label={tr('appt.cancel')} variant="danger" style={{ flex: 1 }} loading={busy} onPress={() => void run(() => api.cancelAppointment(a.id, reason), true)} />
          </View>
        </>
      ) : null}

      {step === 'wa' ? <WaReminder a={a} onBack={() => setStep('view')} /> : null}

      {step === 'reschedule' ? <Reschedule a={a} onBack={() => setStep('view')} onDone={() => { bump(); onClose(); }} /> : null}
    </ScrollView>
  );
}

export function Reschedule({ a, onBack, onDone }: { a: Appointment; onBack: () => void; onDone: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const days = React.useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), []);
  const [date, setDate] = useState(() => { const d = fromIso(a.appointmentDate); return d < days[0] ? days[0] : d; });
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const length = toMin(a.endTime) - toMin(a.startTime);
  const slots = useLoad(() => api.slots(salon!.id, a.serviceId, date, a.staffId), [date.toDateString()]);
  const list = slots.data?.availableSlots ?? [];

  async function save(override = false) {
    if (!time || !salon) return;
    setBusy(true);
    try {
      await api.updateAppointment(a.id, {
        businessId: salon.id, staffId: a.staffId, clientId: a.clientId, clientName: a.clientName, clientPhone: a.clientPhone,
        serviceId: a.serviceId, appointmentDate: toDay(date), startTime: time, endTime: fromMin(toMin(time) + length), price: a.price, notes: a.notes,
      }, override);
      onDone();
    } catch (e) {
      const data = (e as ApiError).data as { code?: string; canOverride?: boolean } | null;
      if (data?.code === 'BOOKING_CONFLICTS' && data.canOverride && !override) {
        Alert.alert(tr('appt.conflict'), undefined, [
          { text: tr('common.cancel'), style: 'cancel' },
          { text: tr('common.confirm'), onPress: () => void save(true) },
        ]);
      } else {
        toast((e as Error).message, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{tr('appt.rescheduleTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => <Chip key={d.toISOString()} label={dateLabel(d)} active={d.toDateString() === date.toDateString()} onPress={() => { setDate(d); setTime(null); }} />)}
      </ScrollView>
      {slots.loading ? <Skeleton rows={1} height={40} /> : list.length === 0 ? (
        <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('create.noSlots')}</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {list.map((s) => <Chip key={s} label={s} active={time === s} onPress={() => setTime(s)} />)}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={onBack} />
        <Btn label={tr('appt.reschedule')} style={{ flex: 1 }} disabled={!time} loading={busy} onPress={() => void save()} />
      </View>
    </>
  );
}

/** Per-booking WhatsApp reminder: the server-built message (from the salon's template), who gets it, send via wa.me, mark as sent. */
export function WaReminder({ a, onBack }: { a: Appointment; onBack: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const q = useLoad(() => apiM.waList(sid, a.appointmentDate.slice(0, 10)), [a.id]);
  const row = (q.data?.rows ?? []).find((r) => String(r.id) === String(a.id));
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<string | null | undefined>(undefined);
  const sent = sentAt === undefined ? row?.sentAt ?? null : sentAt;
  const text = row?.text ?? '';
  const url = row?.waUrl ?? (a.clientPhone ? `https://wa.me/${digits(a.clientPhone)}?text=${encodeURIComponent(text)}` : null);
  async function send() {
    if (!url) return;
    setBusy(true);
    try { await Linking.openURL(url); await apiM.waMark(sid, a.id, true); setSentAt(new Date().toISOString()); toast(tr('ux.waSentAt', { t: new Date().toTimeString().slice(0, 5) }), 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function unmark() { setBusy(true); try { await apiM.waMark(sid, a.id, false); setSentAt(null); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: font.x, fontSize: 26, letterSpacing: -0.7, lineHeight: 31, color: t.ink }}>{tr('ux.waRemind')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={a.clientName ?? ''} size={48} uri={a.clientId != null ? (recallClient(String(a.clientId)) as { avatarUrl?: string | null } | undefined)?.avatarUrl : null} />
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{a.clientName}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{tr('ux.waTo')}: {a.clientPhone}</Text></View>
        <Pill text={sent ? tr('ux.waSentAt', { t: String(sent).slice(11, 16) }) : tr('ux.waNotSent')} tone={sent ? 'ok' : 'amber'} />
      </View>
      {q.loading && !q.data ? <Skeleton rows={1} height={120} /> : row ? (
        <View>
          <Text style={{ fontFamily: font.b, fontSize: 13.5, color: t.muted, marginBottom: 6 }}>{tr('ux.waPreview')}</Text>
          <View style={{ backgroundColor: '#dcf8c6', borderRadius: 22, borderTopLeftRadius: 6, padding: 16 }}>
            <Text style={{ fontFamily: font.m, fontSize: 16, lineHeight: 23, color: '#1d1730' }}>{text}</Text>
          </View>
        </View>
      ) : <Text style={{ fontFamily: font.m, fontSize: 15, lineHeight: 22, color: t.muted }}>{tr('ux.waNoRow')}</Text>}
      <Btn label={tr('ux.waOpen')} icon="chat" loading={busy} disabled={!url || !row} onPress={() => void send()} />
      {sent ? <Btn label={tr('ux.waMarkUnsent')} variant="secondary" loading={busy} onPress={() => void unmark()} /> : null}
      <Btn label={tr('common.back')} variant="secondary" onPress={onBack} />
    </View>
  );
}
