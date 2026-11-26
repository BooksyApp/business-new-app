import React, { useRef, useState } from 'react';
import { Alert, Linking, ScrollView, View, useWindowDimensions } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { Btn, Chip, Field, Pill, Row, Skeleton } from '@/components/ui';
import { Text } from '@/components/Text';
import { markersOf } from '@/components/calendar';
import { t as tr } from '@/i18n';
import { api, ApiError, toDay, type Appointment } from '@/lib/api';
import { useApp } from '@/lib/app';
import { addDays, dateLabel, digits, fromIso, fromMin, hhmm, money, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

type Step = 'view' | 'cancel' | 'reschedule';
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
      bump();
      if (close) onClose();
      else await live.reload();
    } catch (e) {
      Alert.alert(tr('common.error'), (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ maxHeight: H * 0.78 }} contentContainerStyle={{ paddingBottom: 28, gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 24, letterSpacing: -0.5, color: t.ink }}>{a.clientName || '-'}</Text>
          <Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{dateLabel(fromIso(a.appointmentDate))} · {hhmm(a.startTime)}-{hhmm(a.endTime)}</Text>
        </View>
        <Pill text={tr(`status.${a.status}`)} tone={TONE[a.status] ?? 'violet'} />
      </View>

      {step === 'view' ? (
        <>
          {late ? (
            <View style={{ backgroundColor: t.gsoft, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Icon name="timer" size={22} color={t.gink} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.b, fontSize: 14.5, color: t.gink }}>{tr('calendar.late', { min: a.lateMinutes ?? 0 })}</Text>
                <Text style={{ fontFamily: font.m, fontSize: 13, color: t.gink }}>{tr('calendar.lateHint')}</Text>
              </View>
            </View>
          ) : null}
          {phone ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn label={tr('common.call')} icon="phone" variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:${phone}`)} />
              <Btn label={tr('common.whatsapp')} icon="chat" variant="secondary" style={{ flex: 1 }} onPress={() => void Linking.openURL(`https://wa.me/${digits(phone)}`)} />
            </View>
          ) : null}
          <View style={{ backgroundColor: t.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Row label={tr('appt.service')} value={a.serviceName} />
            <Row label={tr('appt.master')} value={a.staffName} />
            <Row label={tr('appt.price')} value={money(a.price, cur)} />
            <Row label={tr('appt.paid')} value={a.paymentStatus === 'PAID' ? tr('appt.paid') : tr('appt.unpaid')} />
            {a.depositAmount ? <Row label={tr('appt.deposit')} value={`${money(a.depositAmount, cur)}${a.depositPaid ? ' ✓' : ''}`} /> : null}
            {a.notes ? <Row label={tr('appt.notes')} value={a.notes} /> : null}
          </View>
          {markersOf(a).length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {markersOf(a).map((m) => (
                <View key={m.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: t.fill }}>
                  <Icon name={m.icon} size={14} color={t.muted} />
                  <Text style={{ fontFamily: font.s, fontSize: 12.5, color: t.muted }}>{tr(m.label)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {live.loading && !live.data ? <Skeleton rows={1} height={20} /> : null}
          {open ? (
            <View style={{ gap: 10 }}>
              {a.status === 'PENDING' ? <Btn label={tr('appt.confirm')} icon="check" loading={busy} onPress={() => void run(() => api.confirmAppointment(a.id))} /> : null}
              <Btn label={tr('appt.reschedule')} icon="cal" variant="secondary" onPress={() => setStep('reschedule')} />
              <Btn label={tr('appt.noShow')} icon="eyeoff" variant="secondary" loading={busy} onPress={() => void run(() => api.noShow(a.id))} />
              <Btn label={tr('appt.cancel')} icon="x" variant="danger" onPress={() => setStep('cancel')} />
            </View>
          ) : null}
        </>
      ) : null}

      {step === 'cancel' ? (
        <>
          <Field label={tr('appt.cancelReason')} value={reason} onChangeText={setReason} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={() => setStep('view')} />
            <Btn label={tr('appt.cancel')} variant="danger" style={{ flex: 1 }} loading={busy} onPress={() => void run(() => api.cancelAppointment(a.id, reason), true)} />
          </View>
        </>
      ) : null}

      {step === 'reschedule' ? <Reschedule a={a} onBack={() => setStep('view')} onDone={() => { bump(); onClose(); }} /> : null}
    </ScrollView>
  );
}

function Reschedule({ a, onBack, onDone }: { a: Appointment; onBack: () => void; onDone: () => void }) {
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
        Alert.alert(tr('common.error'), (e as Error).message);
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
