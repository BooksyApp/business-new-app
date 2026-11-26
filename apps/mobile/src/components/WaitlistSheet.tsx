import { useState } from 'react';
import { Alert, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/BottomSheet';
import { Choice, SectionTitle } from '@/components/form';
import { Text } from '@/components/Text';
import { Btn, Field } from '@/components/ui';
import { t as tr } from '@/i18n';
import { api, toDay } from '@/lib/api';
import { apiX } from '@/lib/api-ext';
import { apiB } from '@/lib/api-biz';
import { useApp } from '@/lib/app';
import { useLoad } from '@/lib/useLoad';
import { useTheme } from '@/theme/ThemeContext';
import { font } from '@/theme/tokens';

/** Put a client on the waitlist by hand (phone call, walk-in): name, phone, service, date, optional time. */
export function WaitlistSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const { t } = useTheme();
  const { salon, bump } = useApp();
  const sid = salon?.id ?? '';
  const svc = useLoad(() => api.services(sid), [sid]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState('');
  const [date, setDate] = useState(() => toDay(new Date()));
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim() || !service) { Alert.alert(tr('common.error'), tr('wl.needName')); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert(tr('common.error'), tr('wl.badDate')); return; }
    setBusy(true);
    try {
      await apiX.addWaitlist(sid, { serviceId: service, clientName: name.trim(), clientPhone: phone.trim() || undefined, preferredDate: date, preferredTime: /^\d{2}:\d{2}$/.test(time) ? time : undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setName(''); setPhone(''); setService(''); setTime('');
      bump(); onAdded();
    } catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 10 }}>{tr('wl.add')}</Text>
      <Field label={tr('wl.name')} value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <SectionTitle>{tr('wl.service')}</SectionTitle>
      <View style={{ maxHeight: 120 }}><Choice value={service} onChange={setService} options={(svc.data ?? []).filter((s) => s.isActive).slice(0, 12).map((s) => ({ value: String(s.id), label: s.name }))} /></View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label={tr('wl.date')} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        <View style={{ flex: 1 }}><Field label={tr('wl.time')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
        <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} onPress={() => void save()} />
      </View>
    </BottomSheet>
  );
}

/** Offer a waiting client one concrete time (date + time + specialist); the server sends it over the waitlist channels. */
export function OfferSheet({ entryId, open, onClose, onSent }: { entryId: string | null; open: boolean; onClose: () => void; onSent: () => void }) {
  const { t } = useTheme();
  const { salon } = useApp();
  const sid = salon?.id ?? '';
  const staff = useLoad(() => api.staff(sid), [sid]);
  const [master, setMaster] = useState('');
  const [date, setDate] = useState(() => toDay(new Date()));
  const [time, setTime] = useState('10:00');
  const [busy, setBusy] = useState(false);
  async function send() {
    const who = master || String((staff.data ?? [])[0]?.id ?? '');
    if (!entryId || !who || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { Alert.alert(tr('common.error'), tr('wl.badDate')); return; }
    setBusy(true);
    try { await apiB.offerWaitlist(sid, entryId, [{ staffId: who, date, startTime: time }]); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); Alert.alert(tr('ad.offerSent')); onSent(); }
    catch (e) { Alert.alert(tr('common.error'), (e as Error).message); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={{ fontFamily: font.x, fontSize: 22, color: t.ink, marginBottom: 4 }}>{tr('ad.offer')}</Text>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginBottom: 10 }}>{tr('ad.offerBody')}</Text>
      <SectionTitle>{tr('ad.master')}</SectionTitle>
      <View style={{ maxHeight: 100 }}><Choice value={master || String((staff.data ?? [])[0]?.id ?? '')} onChange={setMaster} options={(staff.data ?? []).filter((s) => s.isActive !== false).map((s) => ({ value: String(s.id), label: s.name }))} /></View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label={tr('wl.date')} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        <View style={{ flex: 1 }}><Field label={tr('wl.time')} value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 16 }}>
        <Btn label={tr('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={onClose} />
        <Btn label={tr('ad.offer')} style={{ flex: 1 }} loading={busy} onPress={() => void send()} />
      </View>
    </BottomSheet>
  );
}
