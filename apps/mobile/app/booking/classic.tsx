import React, { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from '@/lib/insets';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
import { Avatar, ServiceThumb, Btn, Chip, ErrorState, Field, Skeleton, StateView } from '@/components/ui';
import { DayStrip } from '@/components/calendar';
import { BackBar, Button, IconBtn, T } from '@/components/kit';
import { t as tr } from '@/i18n';
import * as Haptics from 'expo-haptics';
import { api, ApiError, toDay, validId, type Client, type ClientWithStats, type Service, type Staff } from '@/lib/api';
import { useApp } from '@/lib/app';
import { recallClient } from '@/lib/client-cache';
import { apiM, type Combo } from '@/lib/api-more';
import { addDays, dateLabel, fromIso, fromMin, hhmm, money, monthLabel, toMin } from '@/lib/format';
import { useLoad } from '@/lib/useLoad';
import { bookingErrorText } from '@/lib/booking-errors';
import { useTheme } from '@/theme/ThemeContext';
import { barBg, brandInk, circShadow, cardShadow, font } from '@/theme/tokens';

type Pick = { id: string; name: string; phone?: string | null; email?: string | null };
type Repeat = 'none' | 'weekly' | 'biweekly' | 'monthly';
const REPEATS: { k: Repeat; label: 'create.repeatNone' | 'create.repeatWeekly' | 'create.repeatBiweekly' | 'create.repeatMonthly' }[] = [
  { k: 'none', label: 'create.repeatNone' }, { k: 'weekly', label: 'create.repeatWeekly' }, { k: 'biweekly', label: 'create.repeatBiweekly' }, { k: 'monthly', label: 'create.repeatMonthly' },
];
const nextDate = (d: Date, r: Repeat, i: number) => {
  if (r === 'weekly') return addDays(d, 7 * i);
  if (r === 'biweekly') return addDays(d, 14 * i);
  // Month step clamps to the last day (31 Jan + 1 month = 28/29 Feb, not 3 Mar).
  const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
  x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x;
};
/** Resolves true when the user accepts a conflict the server reported as overridable. */
const askOverride = (msg: string) => new Promise<boolean>((res) => Alert.alert(tr('appt.conflict'), msg, [
  { text: tr('common.cancel'), style: 'cancel', onPress: () => res(false) }, { text: tr('common.confirm'), onPress: () => res(true) },
], { cancelable: false }));
const STEPS = ['create.stepClient', 'create.stepService', 'create.stepTime', 'create.stepConfirm'] as const;

/** Full booking form (combos with party, group classes, several services, repeats). Reached from the v2 flow's 'Ətraflı forma'. Was BF04 "yeni rezerv"): back/close circles, 4-bar stepper, step breadcrumb, 30/800 title, dark `.bsk` summary bar with "Davam". */
export default function NewBooking() {
  const { t } = useTheme();
  const router = useRouter();
  const ins = useSafeAreaInsets();
  const { salon, bump } = useApp();
  const params = useLocalSearchParams<{ date?: string; clientId?: string; clientName?: string }>();
  const sid = salon?.id ?? '';
  const preset = params.clientId ? { id: String(params.clientId), name: String(params.clientName ?? '') } : null;
  const [step, setStep] = useState(preset ? 1 : 0);
  const [client, setClient] = useState<Pick | null>(preset);
  const [picked, setPicked] = useState<Service[]>([]);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [times, setTimes] = useState(4);
  const service = picked[0] ?? null;
  const totalMin = picked.reduce((n, x) => n + (x.durationMinutes ?? 30), 0);
  const totalPrice = picked.reduce((n, x) => n + (x.price ?? 0), 0);
  const [master, setMaster] = useState<Staff | null>(null);
  const [date, setDate] = useState(() => (params.date ? fromIso(params.date) : new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const combosQ = useLoad(() => apiM.combos(sid).catch(() => [] as Combo[]), [sid]);
  const combo = picked.length === 1 ? (combosQ.data ?? []).find((c) => String(c.serviceId) === String(picked[0].id)) ?? null : null;
  const [party, setParty] = useState(1);
  const [guests, setGuests] = useState<string[]>([]);

  const back = () => (step === 0 ? router.back() : setStep(step - 1));
  const can = [!!client, picked.length > 0, (!!master || !!combo) && !!time, true][step];

  const [submitErr, setSubmitErr] = useState('');
  async function bookCombo() {
    if (busy || !client || !combo || !time) return;
    setBusy(true); setSubmitErr('');
    const body = { businessId: sid, serviceId: combo.serviceId, partySize: party, guestNames: guests.slice(0, Math.max(0, party - 1)).map((g) => g.trim()), ...(validId(client.id) ? { clientId: client.id } : null), clientName: client.name, ...(client.phone ? { clientPhone: client.phone } : null), appointmentDate: toDay(date), startTime: time };
    try {
      try { await apiM.bookCombo(body); }
      catch (e) {
        const data = e instanceof ApiError ? (e.data as { code?: string; canOverride?: boolean } | null) : null;
        if (data?.code === 'BOOKING_CONFLICTS' && data.canOverride && (await askOverride(`${dateLabel(date)} · ${time}\n${(e as Error).message}`))) await apiM.bookCombo(body, true);
        else throw e;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bump(); router.back();
    } catch (e) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); setSubmitErr(bookingErrorText(e)); toast(bookingErrorText(e), 'error'); } finally { setBusy(false); }
  }

  async function book() {
    setSubmitErr('');
    if (combo) { await bookCombo(); return; }
    if (busy || !client || !service || !master || !time) return;
    if (toMin(time) + totalMin > 24 * 60) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); Alert.alert(tr('create.pastMidnight')); return; }
    setBusy(true);
    let offline = false;
    const failed: string[] = [];
    let created = 0;
    try {
      const n = repeat === 'none' ? 1 : times;
      for (let i = 0; i < n; i++) {
        const day = nextDate(date, repeat, i);
        let at = toMin(time);
        for (const sv of picked) {
          const len = sv.durationMinutes ?? 30;
          const body = {
            businessId: sid, staffId: master.id, clientId: client.id, clientName: client.name, clientPhone: client.phone ?? undefined, clientEmail: client.email ?? undefined, serviceId: sv.id,
            appointmentDate: toDay(day), startTime: fromMin(at), endTime: fromMin(at + len), price: sv.price,
          };
          try {
            try {
              await api.createAppointment(body);
            } catch (e) {
              const data = e instanceof ApiError ? (e.data as { code?: string; canOverride?: boolean } | null) : null;
              if (data?.code === 'BOOKING_CONFLICTS' && data.canOverride && (await askOverride(`${dateLabel(day)} · ${fromMin(at)}\n${(e as Error).message}`))) await api.createAppointment(body, true);
              else throw e;
            }
            created++;
          } catch (e) {
            failed.push(`${dateLabel(day)} ${fromMin(at)}: ${bookingErrorText(e)}`);
            if (e instanceof ApiError && e.status === 0) { offline = true; break; } // no network: stop instead of N identical failures
          }
          at += len;
        }
        if (offline) break;
      }
      if (created) bump();
      if (failed.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSubmitErr(failed[0] ?? '');
        Alert.alert(tr('create.partial', { ok: created, bad: failed.length }), failed.slice(0, 6).join('\n'), [{ text: tr('common.close'), onPress: () => { if (created) router.back(); } }]);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.back();
      }
    } finally {
      setBusy(false);
    }
  }

  const titles = [tr('create.client'), tr('create.pickService'), tr('create.pickTime'), tr('create.confirmTitle')];
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, paddingTop: ins.top + 10, paddingHorizontal: 20 }}>
        <View style={{ marginHorizontal: -20 }}><BackBar label={tr('common.back')} onBack={back} right={<IconBtn icon="x" label={tr('common.close')} onPress={() => router.back()} />} /></View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? t.ink : t.track }} />)}
        </View>
        <Text style={{ fontFamily: font.r, fontSize: 12.5, color: t.muted, marginTop: 10 }}>{step + 1}/4 · {tr(STEPS[step])}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: font.b, fontSize: 26, lineHeight: 31, letterSpacing: -0.65, color: t.ink, marginTop: 2, marginBottom: 14 }}>{titles[step]}</Text>
        <View style={{ flex: 1 }}>
          {step === 0 ? <ClientStep sid={sid} sel={client} onPick={setClient} /> : null}
          {step === 1 ? <ServiceStep sid={sid} sel={picked} cur={salon?.currency} onToggle={(s) => { setPicked((p) => (p.some((x) => x.id === s.id) ? p.filter((x) => x.id !== s.id) : [...p, s])); setMaster(null); setTime(null); }} /> : null}
          {step === 2 && service ? <TimeStep sid={sid} service={service} picked={picked} combo={combo} party={party} setParty={setParty} guests={guests} setGuests={setGuests} master={master} date={date} time={time} setMaster={(m) => { setMaster(m); setTime(null); }} setDate={(d) => { setDate(d); setTime(null); }} setTime={setTime} /> : null}
          {step === 3 && client && service && (master || combo) && time ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140, gap: 14 }}>
              <View style={{ backgroundColor: t.surface, borderRadius: 28, padding: 20, gap: 14, ...cardShadow }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 6 }}>
                  <Avatar name={client.name} size={64} uri={(recallClient(client.id) as { avatarUrl?: string | null } | undefined)?.avatarUrl} />
                  <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 22, letterSpacing: -0.5, color: t.ink }}>{client.name}</Text><Text numberOfLines={1} style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{picked.map((x) => x.name).join(' + ')}</Text></View>
                  {master ? <Avatar name={master.name} size={44} uri={master.avatarUrl} /> : null}
                </View>
                {([[tr('create.client'), client.name], [tr('create.service'), picked.map((x) => x.name).join(' + ')], [tr('create.master'), master?.name ?? tr('ux.anyone')], [tr('create.date'), dateLabel(date)], [tr('create.time'), `${time} – ${fromMin(toMin(time) + totalMin)}`], [tr('appt.price'), money(totalPrice, salon?.currency)]] as const).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                    <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{k}</Text>
                    <Text style={{ fontFamily: font.b, fontSize: 15, color: t.ink, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontFamily: font.b, fontSize: 16, color: t.ink }}>{tr('create.repeat')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
                {REPEATS.map((r) => <Chip key={r.k} label={tr(r.label)} active={repeat === r.k} onPress={() => setRepeat(r.k)} icon={r.k === 'none' ? undefined : 'repeat'} />)}
              </ScrollView>
              {repeat !== 'none' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: 18, padding: 10, paddingLeft: 16 }}>
                  <Text style={{ fontFamily: font.s, fontSize: 15, color: t.ink }}>{tr('create.repeatTimes', { n: times })}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => setTimes((n) => Math.max(2, n - 1))} accessibilityRole="button" accessibilityLabel={tr('create.fewer')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={20} color={t.ink} /></Pressable>
                    <Pressable onPress={() => setTimes((n) => Math.min(12, n + 1))} accessibilityRole="button" accessibilityLabel={tr('create.more')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={20} color={t.ink} /></Pressable>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          ) : null}
        </View>
      </View>
      {submitErr ? <T k="sm" color={t.gink} style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(ins.bottom, 20) + 86, textAlign: 'center' }}>{submitErr}</T> : null}
      {/* `.bsk` dark bar with the running summary and a white action button */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(ins.bottom, 20), borderRadius: 24, backgroundColor: barBg(t.dark), padding: 14, paddingLeft: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: font.s, fontSize: 14, color: 'rgba(255,255,255,.8)' }}>{time ? `${dateLabel(date)} · ${time}` : client?.name ?? tr(STEPS[step])}</Text>
          <Text numberOfLines={1} style={{ fontFamily: font.x, fontSize: 17, color: '#fff' }}>{service ? `${picked.length > 1 ? `${service.name} +${picked.length - 1}` : service.name}${master ? ` · ${master.name}` : ''}` : tr('create.title')}</Text>
        </View>
        <Pressable onPress={() => (step === 3 ? void book() : setStep(step + 1))} disabled={!can || busy} accessibilityRole="button" style={{ minHeight: 48, flexShrink: 0, maxWidth: '62%', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 24, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: can ? 1 : 0.5 }}>
          {busy ? <ActivityIndicator color={brandInk} /> : <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontFamily: font.b, fontSize: 14.5, color: brandInk, flexShrink: 1, textAlign: 'center' }}>{step === 3 ? tr('create.book') : tr('create.next')}</Text>}
          {step < 3 && !busy ? <Icon name="chev" size={18} color={brandInk} /> : null}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ name, sub, on, onPress, uri, thumb }: { name: string; sub?: string; on: boolean; onPress: () => void; uri?: string | null; thumb?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} noScale
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: on ? t.vsoft : 'transparent', borderWidth: on ? 1.5 : 0, borderColor: t.violet }}>
      {thumb ?? <Avatar name={name} size={48} uri={uri} />}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.b, fontSize: 15, color: t.ink }}>{name}</Text>
        {sub ? <Text numberOfLines={1} style={{ fontFamily: font.r, fontSize: 13, color: t.muted }}>{sub}</Text> : null}
      </View>
      {on ? <Icon name="check" size={22} color={t.vtext} /> : null}
    </Pressable>
  );
}

function ClientStep({ sid, sel, onPick }: { sid: string; sel: Pick | null; onPick: (c: Pick) => void }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useLoad<(Client | ClientWithStats)[]>(() => api.clientsWithStats(sid), [sid]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = list.data ?? [];
    return (s ? all.filter((c) => `${c.firstName} ${c.lastName ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(s)) : all).slice(0, 80);
  }, [q, list.data]);
  async function create() {
    setBusy(true);
    try {
      const c = await api.createClient(sid, { firstName: first.trim(), lastName: last.trim() || undefined, phone: phone.trim() || undefined });
      onPick({ id: validId(c.id) ?? '', name: `${c.firstName} ${c.lastName ?? ''}`.trim(), phone: c.phone, email: c.email });
      setAdding(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }
  if (adding) {
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
        <Field label={tr('create.firstName')} value={first} onChangeText={setFirst} />
        <Field label={tr('create.lastName')} value={last} onChangeText={setLast} />
        <Field label={tr('create.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Btn label={tr('common.back')} variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
          <Btn label={tr('common.save')} style={{ flex: 1 }} loading={busy} disabled={!first.trim()} onPress={() => void create()} />
        </View>
      </ScrollView>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 16, backgroundColor: t.fill }}>
        <Icon name="search" size={20} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={tr('create.searchClient')} placeholderTextColor={t.ink3} autoCorrect={false} style={{ flex: 1, fontFamily: font.m, fontSize: 15, color: t.ink }} />
      </View>
      <Pressable onPress={() => setAdding(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }}>
        <Icon name="plus" size={20} color={t.vtext} />
        <Text style={{ fontFamily: font.b, fontSize: 15, color: t.vtext }}>{tr('create.newClient')}</Text>
      </Pressable>
      {list.error ? <ErrorState error={list.error} onRetry={() => void list.reload()} /> : list.loading && !list.data ? <Skeleton rows={4} height={72} /> : (
        <FlatList data={rows} keyExtractor={(c, i) => String(c.id ?? i)} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 2, paddingBottom: 140 }}
          renderItem={({ item: c }) => {
            const name = `${c.firstName} ${c.lastName ?? ''}`.trim();
            return <Row uri={(recallClient(String(c.id)) as { avatarUrl?: string | null } | undefined)?.avatarUrl} name={name} sub={c.phone ?? undefined} on={!!sel?.id && sel.id === c.id} onPress={() => onPick({ id: validId(c.id) ?? '', name, phone: c.phone, email: c.email })} />;
          }} />
      )}
    </View>
  );
}

function ServiceStep({ sid, sel, cur, onToggle }: { sid: string; sel: Service[]; cur?: string; onToggle: (s: Service) => void }) {
  const { t } = useTheme();
  const list = useLoad(() => api.services(sid), [sid]);
  const rows = (list.data ?? []).filter((s) => s.isActive);
  if (list.error) return <ErrorState error={list.error} onRetry={() => void list.reload()} />;
  if (list.loading && !list.data) return <Skeleton rows={4} height={72} />;
  if (!rows.length) return <StateView icon="scissors" title={tr('create.noServices')} />;
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: font.m, fontSize: 13.5, color: t.muted, marginTop: -6, marginBottom: 10 }}>{tr('create.multiHint')}</Text>
      <FlatList data={rows} keyExtractor={(s) => String(s.id)} contentContainerStyle={{ gap: 2, paddingBottom: 140 }}
        renderItem={({ item: s }) => <Row thumb={<ServiceThumb name={s.name} cat={s.categoryName} size={56} />} name={s.name} sub={`${s.durationMinutes ?? 30} ${tr('common.min')} · ${money(s.price, cur)}`} on={sel.some((x) => x.id === s.id)} onPress={() => onToggle(s)} />} />
    </View>
  );
}

function TimeStep({ sid, service, picked, combo, party, setParty, guests, setGuests, master, date, time, setMaster, setDate, setTime }: {
  sid: string; service: Service; picked: Service[]; combo: Combo | null; party: number; setParty: (n: number) => void; guests: string[]; setGuests: (g: string[]) => void; master: Staff | null; date: Date; time: string | null; setMaster: (m: Staff) => void; setDate: (d: Date) => void; setTime: (s: string) => void;
}) {
  const { t } = useTheme();
  const staff = useLoad(() => api.staff(sid), [sid]);
  const masters = (staff.data ?? []).filter((m) => m.isActive !== false && picked.every((sv) => !sv.staffIds?.length || sv.staffIds.map(String).includes(String(m.id))));
  const slots = useLoad(() => (master ? api.slots(sid, service.id, date, master.id) : Promise.resolve(null)), [master?.id, service.id, date.toDateString()]);
  const list = slots.data?.availableSlots ?? [];
  const cs = useLoad(() => (combo ? apiM.comboSlots(sid, combo.serviceId, toDay(date), party) : Promise.resolve(null)), [combo?.serviceId, date.toDateString(), party]);
  if (combo) {
    const cl = cs.data?.availableSlots ?? [];
    return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface, borderRadius: 24, padding: 14, paddingLeft: 18, marginBottom: 8 }}>
          <View style={{ flex: 1 }}><Text style={{ fontFamily: font.x, fontSize: 17, color: t.ink }}>{tr('ux.people', { n: party })}</Text><Text style={{ fontFamily: font.m, fontSize: 14, color: t.muted }}>{combo.totalDurationMinutes} {tr('common.min')} · {money((combo.totalPrice ?? 0) * party, undefined)}</Text></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.fill, borderRadius: 24, padding: 3 }}>
            <Pressable onPress={() => { setParty(Math.max(1, party - 1)); setTime(''); }} accessibilityRole="button" accessibilityLabel="-" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={18} color={t.ink} /></Pressable>
            <Text style={{ fontFamily: font.x, fontSize: 17, minWidth: 24, textAlign: 'center', color: t.ink }}>{party}</Text>
            <Pressable onPress={() => { setParty(Math.min(combo.maxPartySize, party + 1)); setTime(''); }} accessibilityRole="button" accessibilityLabel="+" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} color={t.ink} /></Pressable>
          </View>
        </View>
        {Array.from({ length: Math.max(0, party - 1) }, (_, i) => <Field key={i} label={`${i + 2}.`} value={guests[i] ?? ''} onChangeText={(v) => { const g = [...guests]; g[i] = v; setGuests(g); }} />)}
        <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 12, marginBottom: 6, textTransform: 'capitalize' }}>{monthLabel(date)}</Text>
        <DayStrip date={date} onChange={(d) => setDate(d < new Date(new Date().setHours(0, 0, 0, 0)) ? addDays(new Date(), 0) : d)} />
        <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 18, marginBottom: 8 }}>{tr('create.freeTimes')}</Text>
        {cs.loading ? <ActivityIndicator color={t.violet} /> : cl.length === 0 ? <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('create.noSlots')}</Text> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cl.map((s) => { const on = time === s; return (
              <Pressable key={s} onPress={() => setTime(s)} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ width: '31.5%', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.violet : t.vsoft }}>
                <Text style={{ fontFamily: font.b, fontSize: 14.5, color: on ? '#fff' : t.vtext }}>{hhmm(s)}</Text>
              </Pressable>
            ); })}
          </View>
        )}
      </ScrollView>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
      {staff.error ? <ErrorState error={staff.error} onRetry={() => void staff.reload()} /> : staff.loading ? <Skeleton rows={1} height={72} /> : masters.length === 0 ? (
        <Text style={{ fontFamily: font.m, fontSize: 15, color: t.muted }}>{tr('create.noMasters')}</Text>
      ) : (
        <View>
          <Text style={{ fontFamily: font.x, fontSize: 19, letterSpacing: -0.4, color: t.ink, marginBottom: 12 }}>{tr('create.master')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
            {masters.map((m) => {
              const on = master?.id === m.id;
              return (
                <Pressable key={m.id} onPress={() => setMaster(m)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={m.name} style={{ alignItems: 'center', gap: 6, width: 82 }}>
                  <View style={{ width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: on ? t.ink : 'transparent' }}><Avatar name={m.name} size={68} uri={m.avatarUrl} /></View>
                  <Text numberOfLines={1} style={{ fontFamily: on ? font.x : font.s, fontSize: 14, color: on ? t.ink : t.muted }}>{m.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
      {master ? (
        <>
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 18, marginBottom: 6, textTransform: 'capitalize' }}>{monthLabel(date)}</Text>
          <DayStrip date={date} onChange={(d) => setDate(d < new Date(new Date().setHours(0, 0, 0, 0)) ? addDays(new Date(), 0) : d)} />
          <Text style={{ fontFamily: font.b, fontSize: 17, color: t.ink, marginTop: 20, marginBottom: 8 }}>{tr('create.freeTimes')}</Text>
          {slots.loading ? <ActivityIndicator color={t.violet} /> : list.length === 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={{ fontFamily: font.m, fontSize: 14.5, color: t.muted }}>{tr('n4.noFree')}</Text>
              {slots.data?.nextAvailableDate ? <Button kind="ol" label={tr('n4.nextFree', { d: dateLabel(fromIso(slots.data.nextAvailableDate)) })} onPress={() => { setDate(fromIso(slots.data!.nextAvailableDate!)); setTime(''); }} /> : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {list.map((s) => {
                const on = time === s;
                return (
                  <Pressable key={s} onPress={() => setTime(s)} accessibilityRole="button" accessibilityState={{ selected: on }}
                    style={{ width: '31.5%', height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.violet : t.vsoft }}>
                    <Text style={{ fontFamily: font.b, fontSize: 14.5, color: on ? '#fff' : t.vtext }}>{hhmm(s)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenError';
